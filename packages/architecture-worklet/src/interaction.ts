export interface ArchitectureOptions {
	wheel?: boolean;
}

/** Add an explorable camera without a permanent JavaScript render loop. @param element Painted element. @param options Wheel navigation opt-in. @returns Cleanup restoring the element's previous inline properties. */
export function attachArchitecture(element: HTMLElement, options: ArchitectureOptions = {}): () => void {
	const view = element.ownerDocument.defaultView;
	if (!view) return function noop() {};
	const document = element.ownerDocument;
	const names = ["--worklet-pointer-x", "--worklet-pointer-y", "--architecture-explode", "--architecture-travel"];
	const previous = names.map(function read(name) {
		return { value: element.style.getPropertyValue(name), priority: element.style.getPropertyPriority(name) };
	});
	const reduced = view.matchMedia("(prefers-reduced-motion: reduce)");
	const values = [0.5, 0.5, readNumber(2, 0), readNumber(3, 0)];
	const targets = [...values];
	const dirty = new Set<number>();
	let frame = 0,
		disposed = false,
		last = 0;
	let pointer: number | null = null;
	let keyboardHeld = false;
	/** Read externally driven CSS state before taking ownership. @param index Property index. @param fallback Default. @returns Bounded number. */
	function readNumber(index: number, fallback: number): number {
		const value = parseFloat(view!.getComputedStyle(element).getPropertyValue(names[index]));
		return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback;
	}
	/** Schedule a frame only while interpolation has work and the page is visible. */
	function schedule(): void {
		if (!disposed && !frame && !document.hidden) frame = view!.requestAnimationFrame(update);
	}
	/** Interpolate changed inputs, then stop when settled. @param now Frame timestamp. */
	function update(now: number): void {
		frame = 0;
		if (disposed || document.hidden) return;
		const delta = last ? Math.min(50, now - last) : 16.67;
		last = now;
		for (const index of dirty) {
			const factor = reduced.matches ? 1 : 1 - Math.exp(-delta / (index === 2 ? 190 : 120));
			values[index] += (targets[index] - values[index]) * factor;
			if (Math.abs(targets[index] - values[index]) < 0.0005) {
				values[index] = targets[index];
				dirty.delete(index);
			}
			element.style.setProperty(names[index], values[index].toFixed(4));
		}
		if (dirty.size) schedule();
		else last = 0;
	}
	/** Set an interpolation target. @param index Property. @param value Target. */
	function target(index: number, value: number): void {
		if (!dirty.has(index)) values[index] = readNumber(index, values[index]);
		targets[index] = Math.max(0, Math.min(1, value));
		dirty.add(index);
		schedule();
	}
	/** Track a pointer in the scene. @param event Pointer event. */
	function move(event: PointerEvent): void {
		if (reduced.matches || (event.pointerType === "touch" && pointer !== event.pointerId)) return;
		const rect = element.getBoundingClientRect();
		if (!rect.width || !rect.height) return;
		target(0, (event.clientX - rect.left) / rect.width);
		target(1, (event.clientY - rect.top) / rect.height);
	}
	/** Begin architectural separation for the primary pointer. @param event Pointer event. */
	function down(event: PointerEvent): void {
		if (!event.isPrimary || event.button !== 0) return;
		if ((event.target as Element | null)?.closest?.("button, input, select, textarea, a, summary, [contenteditable]")) return;
		pointer = event.pointerId;
		target(2, 1);
		move(event);
	}
	/** Reassemble after release or cancellation. */
	function release(): void {
		if (pointer === null && !keyboardHeld) return;
		pointer = null;
		keyboardHeld = false;
		target(2, 0);
	}
	/** Recenter when leaving the surface. */
	function leave(): void {
		target(0, 0.5);
		target(1, 0.5);
		release();
	}
	/** Wheel input is enabled only for dedicated experiences. @param event Wheel input. */
	function wheel(event: WheelEvent): void {
		if (!options.wheel || event.ctrlKey) return;
		if ((event.target as Element | null)?.closest?.("input, select, textarea, [contenteditable]")) return;
		const scale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? element.clientHeight : 1;
		const current = dirty.has(3) ? targets[3] : readNumber(3, 0);
		const next = Math.max(0, Math.min(1, current + event.deltaY * scale * 0.00045));
		if (next === current) return;
		event.preventDefault();
		target(3, next);
	}
	/** Keyboard navigation works only while the painted surface has focus. @param event Keyboard input. */
	function key(event: KeyboardEvent): void {
		if (event.target !== element) return;
		if (event.key === "ArrowUp" || event.key === "ArrowDown") {
			event.preventDefault();
			const current = dirty.has(3) ? targets[3] : readNumber(3, 0);
			target(3, current + (event.key === "ArrowUp" ? 0.05 : -0.05));
		} else if (event.code === "Space") {
			event.preventDefault();
			keyboardHeld = true;
			target(2, 1);
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
		last = 0;
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
		for (let i = 0; i < names.length; i++) {
			if (previous[i].value) element.style.setProperty(names[i], previous[i].value, previous[i].priority);
			else element.style.removeProperty(names[i]);
		}
	};
}
