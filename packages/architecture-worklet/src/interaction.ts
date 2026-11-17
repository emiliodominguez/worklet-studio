import { elapsed, frequency, rest, settled, spring, stepSpring } from "../../core/src/motion.ts";
import type { Frequency, Spring } from "../../core/src/motion.ts";

/** Gentler stiffness for the view relaxing to center after the pointer leaves. */
const RETURN_FREQUENCY = frequency(2.4);

/** One animated CSS input: its property, spring, goal and stiffness travel together. */
interface Channel {
	readonly name: string;
	/** Stiffness used for direct input. Lower values move more slowly. */
	readonly stiffness: Frequency;
	readonly state: Spring;
	target: number;
	/** Stiffness of the current motion: the channel's own, or a gentler one while relaxing. */
	current: Frequency;
}
/** Pause before relaxing, so brief exits to nearby controls do not move the camera. */
const RETURN_DELAY = 900;

export interface ArchitectureOptions {
	wheel?: boolean;
}

/** Add an explorable camera without a permanent JavaScript render loop. @param element Painted element. @param options Wheel navigation opt-in. @returns Cleanup restoring the element's previous inline properties. */
export function attachArchitecture(element: HTMLElement, options: ArchitectureOptions = {}): () => void {
	const view = element.ownerDocument.defaultView;
	if (!view) return function noop() {};
	const document = element.ownerDocument;
	/** Read externally driven CSS state before taking ownership. @param name Custom property. @param fallback Default. @returns Bounded number. */
	function readNumber(name: string, fallback: number): number {
		const value = parseFloat(view!.getComputedStyle(element).getPropertyValue(name));
		return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback;
	}
	/** Create a channel resting at its current CSS value. @param name Custom property. @param fallback Default. @param stiffness Direct-input stiffness. @returns Channel. */
	function channel(name: string, fallback: number, stiffness: Frequency): Channel {
		const state = spring(readNumber(name, fallback));
		return { name, stiffness, state, target: state.value, current: stiffness };
	}
	const lookX = channel("--worklet-pointer-x", 0.5, frequency(9)),
		lookY = channel("--worklet-pointer-y", 0.5, frequency(9)),
		explode = channel("--architecture-explode", 0, frequency(6.5)),
		travel = channel("--architecture-travel", 0, frequency(7.5));
	const channels = [lookX, lookY, explode, travel];
	const previous = channels.map(function read({ name }) {
		return { name, value: element.style.getPropertyValue(name), priority: element.style.getPropertyPriority(name) };
	});
	const reduced = view.matchMedia("(prefers-reduced-motion: reduce)");
	const dirty = new Set<Channel>();
	let frame = 0,
		disposed = false;
	let timer: number | undefined, last: number | undefined;
	let pointer: number | null = null;
	let keyboardHeld = false;
	/** Schedule a frame only while interpolation has work and the page is visible. */
	function schedule(): void {
		if (!disposed && !frame && !document.hidden) frame = view!.requestAnimationFrame(update);
	}
	/** Advance changed inputs on critically damped springs, then stop when settled. @param now Frame timestamp. */
	function update(now: number): void {
		frame = 0;
		if (disposed || document.hidden) return;
		const seconds = elapsed(now, last);
		last = now;
		for (const input of dirty) {
			if (reduced.matches) rest(input.state, input.target);
			else stepSpring(input.state, input.target, input.current, seconds);
			if (reduced.matches || settled(input.state, input.target, 0.0005)) {
				rest(input.state, input.target);
				dirty.delete(input);
			}
			element.style.setProperty(input.name, input.state.value.toFixed(4));
		}
		if (dirty.size) schedule();
		else last = undefined;
	}
	/** Set a spring target. Idle inputs first adopt any externally driven CSS value, so the motion continues from what is on screen. @param input Channel. @param value Target. @param stiffness Optional stiffness; defaults to the channel's own. */
	function target(input: Channel, value: number, stiffness = input.stiffness): void {
		if (!dirty.has(input)) rest(input.state, readNumber(input.name, input.state.value));
		input.target = Math.max(0, Math.min(1, value));
		input.current = stiffness;
		dirty.add(input);
		schedule();
	}
	/** Cancel a pending return to center. */
	function hold(): void {
		if (timer !== undefined) view!.clearTimeout(timer);
		timer = undefined;
	}
	/** Track a pointer in the scene. @param event Pointer event. */
	function move(event: PointerEvent): void {
		if (reduced.matches || (event.pointerType === "touch" && pointer !== event.pointerId)) return;
		const rect = element.getBoundingClientRect();
		if (!rect.width || !rect.height) return;
		hold();
		target(lookX, (event.clientX - rect.left) / rect.width);
		target(lookY, (event.clientY - rect.top) / rect.height);
	}
	/** Begin architectural separation for the primary pointer. @param event Pointer event. */
	function down(event: PointerEvent): void {
		if (!event.isPrimary || event.button !== 0) return;
		if ((event.target as Element | null)?.closest?.("button, input, select, textarea, a, summary, [contenteditable]")) return;
		pointer = event.pointerId;
		target(explode, 1);
		move(event);
	}
	/** Reassemble after release or cancellation. */
	function release(): void {
		if (pointer === null && !keyboardHeld) return;
		pointer = null;
		keyboardHeld = false;
		target(explode, 0);
	}
	/** Relax the view to center after a short pause, and reassemble the floors. */
	function leave(): void {
		hold();
		release();
		timer = view!.setTimeout(function relax() {
			timer = undefined;
			target(lookX, 0.5, RETURN_FREQUENCY);
			target(lookY, 0.5, RETURN_FREQUENCY);
		}, RETURN_DELAY);
	}
	/** Wheel input is enabled only for dedicated experiences. @param event Wheel input. */
	function wheel(event: WheelEvent): void {
		if (!options.wheel || event.ctrlKey) return;
		if ((event.target as Element | null)?.closest?.("input, select, textarea, [contenteditable]")) return;
		const scale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? element.clientHeight : 1;
		const current = dirty.has(travel) ? travel.target : readNumber(travel.name, 0);
		const next = Math.max(0, Math.min(1, current + event.deltaY * scale * 0.00045));
		if (next === current) return;
		event.preventDefault();
		target(travel, next);
	}
	/** Keyboard navigation works only while the painted surface has focus. @param event Keyboard input. */
	function key(event: KeyboardEvent): void {
		if (event.target !== element) return;
		if (event.key === "ArrowUp" || event.key === "ArrowDown") {
			event.preventDefault();
			const current = dirty.has(travel) ? travel.target : readNumber(travel.name, 0);
			target(travel, current + (event.key === "ArrowUp" ? 0.05 : -0.05));
		} else if (event.code === "Space") {
			event.preventDefault();
			keyboardHeld = true;
			target(explode, 1);
		}
	}
	/** Release a keyboard hold. @param event Keyboard input. */
	function keyup(event: KeyboardEvent): void {
		if (event.code === "Space") release();
	}
	/** Stop work on hidden pages and discard held input. */
	function visibility(): void {
		if (frame) view!.cancelAnimationFrame(frame);
		frame = 0;
		last = undefined;
		release();
		if (!document.hidden && dirty.size) schedule();
	}
	element.addEventListener("pointermove", move, { passive: true });
	element.addEventListener("pointerdown", down);
	element.addEventListener("pointerleave", leave);
	element.addEventListener("pointercancel", release);
	element.addEventListener("keydown", key);
	element.addEventListener("blur", release);
	if (options.wheel) element.addEventListener("wheel", wheel, { passive: false });
	view.addEventListener("pointerup", release);
	view.addEventListener("keyup", keyup);
	view.addEventListener("blur", leave);
	reduced.addEventListener("change", leave);
	document.addEventListener("visibilitychange", visibility);
	return function cleanup(): void {
		if (disposed) return;
		disposed = true;
		hold();
		if (frame) view.cancelAnimationFrame(frame);
		element.removeEventListener("pointermove", move);
		element.removeEventListener("pointerdown", down);
		element.removeEventListener("pointerleave", leave);
		element.removeEventListener("pointercancel", release);
		element.removeEventListener("keydown", key);
		element.removeEventListener("blur", release);
		element.removeEventListener("wheel", wheel);
		view.removeEventListener("pointerup", release);
		view.removeEventListener("keyup", keyup);
		view.removeEventListener("blur", leave);
		reduced.removeEventListener("change", leave);
		document.removeEventListener("visibilitychange", visibility);
		for (const { name, value, priority } of previous) {
			if (value) element.style.setProperty(name, value, priority);
			else element.style.removeProperty(name);
		}
	};
}
