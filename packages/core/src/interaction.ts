import { elapsed, frequency, inline, rest, settled, spring, stepSpring, unreachable } from "./motion.ts";
import type { Frequency, Point } from "./motion.ts";

/** Stiffness while following the pointer: responsive, with no kink when motion starts or stops. */
const FOLLOW_FREQUENCY = frequency(9);
/** Stiffness of the drift back to center after the pointer leaves: slow enough to read as the scene relaxing. */
const RETURN_FREQUENCY = frequency(2.4);
/** Pause before relaxing, so brief exits to nearby controls do not move the scene. */
const RETURN_DELAY = 900;
/** The resting, centered view. */
const CENTER: Point = { x: 0.5, y: 0.5 };

/** Where the view is heading: the pointer, or a slow relax back to center. */
type Goal = { readonly kind: "follow"; readonly point: Point } | { readonly kind: "relax" };

/**
 * Resolve a goal into its spring target and stiffness.
 * @param goal Current goal.
 * @returns Target point and the frequency to reach it with.
 */
function aim(goal: Goal): { point: Point; stiffness: Frequency } {
	switch (goal.kind) {
		case "follow":
			return { point: goal.point, stiffness: FOLLOW_FREQUENCY };
		case "relax":
			return { point: CENTER, stiffness: RETURN_FREQUENCY };
		default:
			return unreachable(goal);
	}
}

/** Keep a coordinate inside the normalized surface. @param value Coordinate. @returns Bounded coordinate. */
function clamp(value: number): number {
	return Math.max(0, Math.min(1, value));
}

/** Add spring-eased lighting and parallax inputs. Leaves scrolling intact and disables decorative tracking under reduced motion. Continues from values a previous helper left inline. @param element Painted element. @returns Idempotent cleanup restoring previous inline properties. */
export function attachView(element: HTMLElement): () => void {
	const view = element.ownerDocument.defaultView;
	if (!view) return function noop() {};
	const names = ["--worklet-pointer-x", "--worklet-pointer-y"];
	const previous = names.map(function read(name) {
		return { name, value: element.style.getPropertyValue(name), priority: element.style.getPropertyPriority(name) };
	});
	const reduced = view.matchMedia("(prefers-reduced-motion: reduce)");
	const x = spring(clamp(inline(element, names[0]) ?? CENTER.x)),
		y = spring(clamp(inline(element, names[1]) ?? CENTER.y));
	let goal: Goal = { kind: "follow", point: { x: x.value, y: y.value } };
	let frame = 0,
		disposed = false;
	let timer: number | undefined, lastTime: number | undefined;
	/** Schedule only while the document is visible. */
	function schedule(): void {
		if (!frame && !disposed && !element.ownerDocument.hidden) frame = view!.requestAnimationFrame(update);
	}
	/** Advance both springs and stop the loop once they rest. @param now Frame timestamp. */
	function update(now: number): void {
		frame = 0;
		if (disposed || element.ownerDocument.hidden) return;
		const seconds = elapsed(now, lastTime);
		lastTime = now;
		if (reduced.matches) goal = { kind: "relax" };
		const { point, stiffness } = aim(goal);
		if (reduced.matches) {
			rest(x, point.x);
			rest(y, point.y);
		} else {
			stepSpring(x, point.x, stiffness, seconds);
			stepSpring(y, point.y, stiffness, seconds);
		}
		const done = settled(x, point.x, 0.0005) && settled(y, point.y, 0.0005);
		if (done) {
			rest(x, point.x);
			rest(y, point.y);
			lastTime = undefined;
		}
		element.style.setProperty(names[0], x.value.toFixed(4));
		element.style.setProperty(names[1], y.value.toFixed(4));
		if (!done) schedule();
	}
	/** Cancel a pending return to center. */
	function hold(): void {
		if (timer !== undefined) view!.clearTimeout(timer);
		timer = undefined;
	}
	/** Accept normalized pointer coordinates without capturing touch gestures. @param event Pointer movement. */
	function move(event: PointerEvent): void {
		if (reduced.matches) return;
		const rect = element.getBoundingClientRect();
		if (!rect.width || !rect.height) return;
		hold();
		goal = { kind: "follow", point: { x: clamp((event.clientX - rect.left) / rect.width), y: clamp((event.clientY - rect.top) / rect.height) } };
		schedule();
	}
	/** Drift back to the centered view, softly and after a short pause. */
	function leave(): void {
		hold();
		timer = view!.setTimeout(function relax() {
			timer = undefined;
			goal = { kind: "relax" };
			schedule();
		}, RETURN_DELAY);
	}
	/** Center immediately when reduced motion is requested. */
	function preference(): void {
		hold();
		goal = { kind: "relax" };
		schedule();
	}
	/** Suspend work while the document is hidden and resume from the same state. */
	function visibility(): void {
		if (frame) view!.cancelAnimationFrame(frame);
		frame = 0;
		lastTime = undefined;
		if (!element.ownerDocument.hidden) schedule();
	}
	element.addEventListener("pointermove", move, { passive: true });
	element.addEventListener("pointerleave", leave);
	element.addEventListener("pointercancel", leave);
	reduced.addEventListener("change", preference);
	element.ownerDocument.addEventListener("visibilitychange", visibility);
	if (reduced.matches && (x.value !== CENTER.x || y.value !== CENTER.y)) schedule();
	return function cleanup(): void {
		if (disposed) return;
		disposed = true;
		hold();
		if (frame) view.cancelAnimationFrame(frame);
		element.removeEventListener("pointermove", move);
		element.removeEventListener("pointerleave", leave);
		element.removeEventListener("pointercancel", leave);
		reduced.removeEventListener("change", preference);
		element.ownerDocument.removeEventListener("visibilitychange", visibility);
		for (const { name, value, priority } of previous) {
			if (value) element.style.setProperty(name, value, priority);
			else element.style.removeProperty(name);
		}
	};
}
