declare const frequencyBrand: unique symbol;
declare const elapsedBrand: unique symbol;

/** A positive, finite angular frequency in radians per second. Only {@link frequency} creates one. */
export type Frequency = number & { readonly [frequencyBrand]: true };

/** Elapsed frame time in seconds, bounded to 1–64 ms so a spring can neither stall nor jump after a long pause. Only {@link elapsed} creates one. */
export type Elapsed = number & { readonly [elapsedBrand]: true };

/** A position in two dimensions. */
export interface Point {
	x: number;
	y: number;
}

/** Mutable state of a one-dimensional spring. */
export interface Spring {
	/** Current position. */
	value: number;
	/** Current velocity in units per second. */
	velocity: number;
}

/** Assumed duration of the first frame after a pause, in milliseconds. */
const FIRST_FRAME = 16.67;
/** Shortest frame counted, in milliseconds; keeps per-frame rates finite. */
const SHORTEST_FRAME = 1;
/** Longest frame counted, in milliseconds; a stalled tab resumes smoothly instead of leaping. */
const LONGEST_FRAME = 64;

/**
 * Validate an angular frequency.
 * @param radiansPerSecond Spring stiffness; the spring settles in roughly 6 / radiansPerSecond seconds.
 * @returns The checked frequency.
 * @throws RangeError when the value is not positive and finite, since such a spring would never settle or would diverge.
 */
export function frequency(radiansPerSecond: number): Frequency {
	if (!Number.isFinite(radiansPerSecond) || radiansPerSecond <= 0) throw new RangeError(`Spring frequency must be positive: ${radiansPerSecond}`);
	return radiansPerSecond as Frequency;
}

/**
 * Measure a frame's duration from two animation timestamps.
 * @param now Current timestamp in milliseconds.
 * @param previous Previous timestamp, or undefined for the first frame after a pause.
 * @returns Bounded elapsed seconds.
 */
export function elapsed(now: number, previous: number | undefined): Elapsed {
	const milliseconds = previous === undefined || !Number.isFinite(now - previous) ? FIRST_FRAME : now - previous;
	return (Math.max(SHORTEST_FRAME, Math.min(LONGEST_FRAME, milliseconds)) / 1000) as Elapsed;
}

/**
 * Create a spring at rest.
 * @param value Initial position.
 * @returns Spring state with zero velocity.
 */
export function spring(value: number): Spring {
	return { value, velocity: 0 };
}

/**
 * Advance a critically damped spring with its closed-form solution. Unlike per-frame exponential easing, velocity is
 * continuous, so motion starts and stops without a visible kink, and the result is exact at any frame rate.
 * @param state Spring to advance in place.
 * @param target Rest position.
 * @param stiffness Angular frequency.
 * @param seconds Elapsed time.
 */
export function stepSpring(state: Spring, target: number, stiffness: Frequency, seconds: Elapsed): void {
	const offset = state.value - target;
	const decay = Math.exp(-stiffness * seconds);
	const slope = state.velocity + stiffness * offset;
	state.value = target + (offset + slope * seconds) * decay;
	state.velocity = (state.velocity - stiffness * slope * seconds) * decay;
}

/**
 * Test whether a spring has effectively come to rest.
 * @param state Spring state.
 * @param target Rest position.
 * @param epsilon Largest negligible distance; velocity is compared against ten times this per second.
 * @returns Whether the spring can be snapped to its target.
 */
export function settled(state: Spring, target: number, epsilon: number): boolean {
	return Math.abs(state.value - target) < epsilon && Math.abs(state.velocity) < epsilon * 10;
}

/**
 * Snap a spring to its target and stop it.
 * @param state Spring to stop in place.
 * @param target Rest position.
 */
export function rest(state: Spring, target: number): void {
	state.value = target;
	state.velocity = 0;
}

/**
 * Convert a per-frame easing fraction into a frame-rate independent factor.
 * @param fraction Distance covered per 60 Hz frame, clamped to 0–1.
 * @param seconds Elapsed time.
 * @returns Fraction to apply for the elapsed time.
 */
export function ease(fraction: number, seconds: Elapsed): number {
	return 1 - Math.pow(1 - Math.max(0, Math.min(1, fraction)), (seconds * 1000) / FIRST_FRAME);
}

/**
 * Read a finite inline custom property, used to continue from a previous helper's state.
 * @param element Styled element.
 * @param name Custom property name.
 * @returns The parsed number, or undefined when absent or malformed.
 */
export function inline(element: HTMLElement, name: string): number | undefined {
	const value = Number.parseFloat(element.style.getPropertyValue(name));
	return Number.isFinite(value) ? value : undefined;
}

/**
 * Read an inline position whose coordinates are only meaningful together.
 * @param element Styled element.
 * @param nameX Custom property holding x.
 * @param nameY Custom property holding y.
 * @returns The point, or undefined unless both coordinates are present and finite.
 */
export function inlinePoint(element: HTMLElement, nameX: string, nameY: string): Point | undefined {
	const x = inline(element, nameX),
		y = inline(element, nameY);
	return x === undefined || y === undefined ? undefined : { x, y };
}

/**
 * Fail the type check when a union case is left unhandled.
 * @param value The impossible remainder.
 * @returns Never.
 * @throws Error if reached at runtime through an unchecked cast.
 */
export function unreachable(value: never): never {
	throw new Error(`Unhandled case: ${JSON.stringify(value)}`);
}
