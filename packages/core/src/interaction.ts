/** Add eased lighting and parallax inputs. Leaves scrolling intact and disables decorative tracking under reduced motion. @param element Painted element. @returns Idempotent cleanup restoring previous inline properties. */
export function attachView(element: HTMLElement): () => void {
	const view = element.ownerDocument.defaultView;
	if (!view) return function noop() {};
	const names = ["--worklet-pointer-x", "--worklet-pointer-y"];
	const previous = names.map(function read(name) {
		return { value: element.style.getPropertyValue(name), priority: element.style.getPropertyPriority(name) };
	});
	const reduced = view.matchMedia("(prefers-reduced-motion: reduce)");
	let x = 0.5,
		y = 0.5,
		targetX = 0.5,
		targetY = 0.5,
		frame = 0,
		lastTime = 0,
		disposed = false;
	/** Schedule only while the document is visible. */
	function schedule(): void {
		if (!frame && !disposed && !element.ownerDocument.hidden) frame = view!.requestAnimationFrame(update);
	}
	/** Ease towards the latest pointer without a permanent animation loop. @param now Frame timestamp. */
	function update(now: number): void {
		frame = 0;
		if (disposed || element.ownerDocument.hidden) return;
		const delta = lastTime ? Math.min(48, now - lastTime) : 16.67;
		const factor = 1 - Math.pow(0.84, delta / 16.67);
		x += (targetX - x) * factor;
		y += (targetY - y) * factor;
		lastTime = now;
		if (Math.hypot(targetX - x, targetY - y) < 0.001) {
			x = targetX;
			y = targetY;
		}
		if (reduced.matches) {
			x = 0.5;
			y = 0.5;
		}
		element.style.setProperty(names[0], x.toFixed(4));
		element.style.setProperty(names[1], y.toFixed(4));
		if (!reduced.matches && (x !== targetX || y !== targetY)) schedule();
	}
	/** Accept normalized pointer coordinates without capturing touch gestures. @param event Pointer movement. */
	function move(event: PointerEvent): void {
		if (reduced.matches) return;
		const rect = element.getBoundingClientRect();
		if (!rect.width || !rect.height) return;
		targetX = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
		targetY = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
		schedule();
	}
	/** Return to the centered view when input ends or motion preferences change. */
	function reset(): void {
		targetX = 0.5;
		targetY = 0.5;
		schedule();
	}
	/** Suspend work while the document is hidden. */
	function visibility(): void {
		if (frame) view!.cancelAnimationFrame(frame);
		frame = 0;
		lastTime = 0;
		if (!element.ownerDocument.hidden) reset();
	}
	element.addEventListener("pointermove", move, { passive: true });
	element.addEventListener("pointerleave", reset);
	element.addEventListener("pointercancel", reset);
	reduced.addEventListener("change", reset);
	element.ownerDocument.addEventListener("visibilitychange", visibility);
	return function cleanup(): void {
		if (disposed) return;
		disposed = true;
		if (frame) view.cancelAnimationFrame(frame);
		element.removeEventListener("pointermove", move);
		element.removeEventListener("pointerleave", reset);
		element.removeEventListener("pointercancel", reset);
		reduced.removeEventListener("change", reset);
		element.ownerDocument.removeEventListener("visibilitychange", visibility);
		for (let i = 0; i < names.length; i++) {
			if (previous[i].value) element.style.setProperty(names[i], previous[i].value, previous[i].priority);
			else element.style.removeProperty(names[i]);
		}
	};
}
