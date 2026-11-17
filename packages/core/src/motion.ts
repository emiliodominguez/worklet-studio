/** Mutable state of a one-dimensional spring. */
export interface Spring {
	/** Current position. */
	value: number;
	/** Current velocity in units per second. */
	velocity: number;
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
 * @param frequency Angular frequency in radians per second; the spring settles in roughly 6 / frequency seconds.
 * @param seconds Elapsed time.
 */
export function stepSpring(state: Spring, target: number, frequency: number, seconds: number): void {
	const offset = state.value - target;
	const decay = Math.exp(-frequency * seconds);
	const slope = state.velocity + frequency * offset;
	state.value = target + (offset + slope * seconds) * decay;
	state.velocity = (state.velocity - frequency * slope * seconds) * decay;
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
 * Convert a per-frame easing fraction into a frame-rate independent factor.
 * @param fraction Distance covered per 60 Hz frame, 0–1.
 * @param milliseconds Elapsed time.
 * @returns Fraction to apply for the elapsed time.
 */
export function ease(fraction: number, milliseconds: number): number {
	return 1 - Math.pow(1 - Math.max(0, Math.min(1, fraction)), milliseconds / 16.67);
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
