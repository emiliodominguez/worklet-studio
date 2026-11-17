import { inline, settled, spring, stepSpring } from "./motion.ts";

/** Angular frequency while following the pointer: responsive, with no kink when motion starts or stops. */
const FOLLOW_FREQUENCY = 9;
/** Angular frequency of the drift back to center after the pointer leaves: slow enough to read as the scene relaxing. */
const RETURN_FREQUENCY = 2.4;
/** Pause before relaxing, so brief exits to nearby controls do not move the scene. */
const RETURN_DELAY = 900;

/** Add spring-eased lighting and parallax inputs. Leaves scrolling intact and disables decorative tracking under reduced motion. Continues from values a previous helper left inline. @param element Painted element. @returns Idempotent cleanup restoring previous inline properties. */
export function attachView(element: HTMLElement): () => void {
	const view = element.ownerDocument.defaultView;
	if (!view) return function noop() {};
	const names = ["--worklet-pointer-x", "--worklet-pointer-y"];
	const previous = names.map(function read(name) {
		return { value: element.style.getPropertyValue(name), priority: element.style.getPropertyPriority(name) };
	});
	const reduced = view.matchMedia("(prefers-reduced-motion: reduce)");
	const x = spring(clamp(inline(element, names[0]) ?? 0.5)),
		y = spring(clamp(inline(element, names[1]) ?? 0.5));
	let targetX = x.value,
		targetY = y.value,
		frequency = FOLLOW_FREQUENCY,
		frame = 0,
		timer = 0,
		lastTime = 0,
		disposed = false;
	/** Keep a coordinate inside the normalized surface. @param value Coordinate. @returns Bounded coordinate. */
	function clamp(value: number): number {
		return Math.max(0, Math.min(1, value));
	}
	/** Schedule only while the document is visible. */
	function schedule(): void {
		if (!frame && !disposed && !element.ownerDocument.hidden) frame = view!.requestAnimationFrame(update);
	}
	/** Advance both springs and stop the loop once they rest. @param now Frame timestamp. */
	function update(now: number): void {
		frame = 0;
		if (disposed || element.ownerDocument.hidden) return;
		const seconds = (lastTime ? Math.min(64, now - lastTime) : 16.67) / 1000;
		lastTime = now;
		if (reduced.matches) {
			x.value = targetX = 0.5;
			y.value = targetY = 0.5;
			x.velocity = y.velocity = 0;
		} else {
			stepSpring(x, targetX, frequency, seconds);
			stepSpring(y, targetY, frequency, seconds);
		}
		const rest = settled(x, targetX, 0.0005) && settled(y, targetY, 0.0005);
		if (rest) {
			x.value = targetX;
			y.value = targetY;
			x.velocity = y.velocity = 0;
			lastTime = 0;
		}
		element.style.setProperty(names[0], x.value.toFixed(4));
		element.style.setProperty(names[1], y.value.toFixed(4));
		if (!rest) schedule();
	}
	/** Cancel a pending return to center. */
	function hold(): void {
		if (timer) view!.clearTimeout(timer);
		timer = 0;
	}
	/** Accept normalized pointer coordinates without capturing touch gestures. @param event Pointer movement. */
	function move(event: PointerEvent): void {
		if (reduced.matches) return;
		const rect = element.getBoundingClientRect();
		if (!rect.width || !rect.height) return;
		hold();
		frequency = FOLLOW_FREQUENCY;
		targetX = clamp((event.clientX - rect.left) / rect.width);
		targetY = clamp((event.clientY - rect.top) / rect.height);
		schedule();
	}
	/** Drift back to the centered view, softly and after a short pause. */
	function leave(): void {
		hold();
		timer = view!.setTimeout(function relax() {
			timer = 0;
			frequency = RETURN_FREQUENCY;
			targetX = 0.5;
			targetY = 0.5;
			schedule();
		}, RETURN_DELAY);
	}
	/** Center immediately when reduced motion is requested. */
	function preference(): void {
		hold();
		targetX = 0.5;
		targetY = 0.5;
		schedule();
	}
	/** Suspend work while the document is hidden and resume from the same state. */
	function visibility(): void {
		if (frame) view!.cancelAnimationFrame(frame);
		frame = 0;
		lastTime = 0;
		if (!element.ownerDocument.hidden) schedule();
	}
	element.addEventListener("pointermove", move, { passive: true });
	element.addEventListener("pointerleave", leave);
	element.addEventListener("pointercancel", leave);
	reduced.addEventListener("change", preference);
	element.ownerDocument.addEventListener("visibilitychange", visibility);
	if (reduced.matches && (x.value !== 0.5 || y.value !== 0.5)) schedule();
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
		for (let i = 0; i < names.length; i++) {
			if (previous[i].value) element.style.setProperty(names[i], previous[i].value, previous[i].priority);
			else element.style.removeProperty(names[i]);
		}
	};
}
