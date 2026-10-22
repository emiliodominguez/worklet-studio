import { loadWorklet } from "../../core/src/register.ts";

/** Register the painter. @param url Optional hosted module URL. @returns Whether CSS Paint is supported and the module loaded. */
export function register(url: string | URL = new URL("../worklet.js", import.meta.url)): Promise<boolean> {
	return loadWorklet(url);
}

export interface PointerOptions {
	/** Follow touch pointers without preventing scrolling. Default false. */
	touch?: boolean;
	/** Fraction of distance covered per 60 Hz frame, 0.05–1. Default 1 preserves direct tracking. */
	smoothing?: number;
	/** History points for ribbon/comet modes, 2–32. Default 24. */
	trail?: number;
}

/** Track local pointer position, bounded history, speed, and press state. Respects reduced motion and stops when settled. @param element Painted element. @param options Pointer behavior. @returns Idempotent cleanup restoring all previous inline values. */
export function attachPointer(element: HTMLElement, options: PointerOptions = {}): () => void {
	const view = element.ownerDocument.defaultView;
	if (!view) return function noop() {};
	const names = ["--cursor-position-x", "--cursor-position-y", "--cursor-trail", "--cursor-speed", "--cursor-press"];
	const previous = names.map(function read(name) {
		return { value: element.style.getPropertyValue(name), priority: element.style.getPropertyPriority(name) };
	});
	const smoothing = Number.isFinite(options.smoothing) ? Math.max(0.05, Math.min(1, options.smoothing!)) : 1;
	const limit = Number.isFinite(options.trail) ? Math.max(2, Math.min(32, Math.floor(options.trail!))) : 24;
	const reduced = view.matchMedia("(prefers-reduced-motion: reduce)");
	let frame = 0,
		lastTime = 0,
		sampleTime = 0,
		until = 0,
		clientX = 0,
		clientY = 0,
		x = 0,
		y = 0;
	let initialized = false,
		disposed = false,
		targetPress = 0,
		press = 0;
	let history: { x: number; y: number }[] = [];

	/** Schedule a frame only while the document is visible. */
	function schedule(): void {
		if (!frame && !disposed && !element.ownerDocument.hidden) frame = view!.requestAnimationFrame(update);
	}
	/** Advance smoothing and publish bounded, finite CSS inputs. @param now Animation timestamp. */
	function update(now: number): void {
		frame = 0;
		if (disposed || !initialized || element.ownerDocument.hidden) return;
		const rect = element.getBoundingClientRect();
		if (rect.width <= 0 || rect.height <= 0) return;
		const targetX = ((clientX - rect.left) * element.offsetWidth) / rect.width;
		const targetY = ((clientY - rect.top) * element.offsetHeight) / rect.height;
		const delta = lastTime ? Math.min(48, Math.max(1, now - lastTime)) : 16.67;
		const factor = reduced.matches ? 1 : 1 - Math.pow(1 - smoothing, delta / 16.67);
		const dx = (targetX - x) * factor,
			dy = (targetY - y) * factor;
		x += dx;
		y += dy;
		lastTime = now;
		press += (targetPress - press) * (reduced.matches ? 1 : 0.3);
		if (Math.abs(targetPress - press) < 0.001) press = targetPress;
		if (Math.hypot(targetX - x, targetY - y) < 0.05) {
			x = targetX;
			y = targetY;
		}
		if (now - sampleTime >= 14 || !history.length) {
			history.unshift({ x, y });
			history = history.slice(0, reduced.matches ? 1 : limit);
			sampleTime = now;
		}
		element.style.setProperty(names[0], x.toFixed(2));
		element.style.setProperty(names[1], y.toFixed(2));
		element.style.setProperty(
			names[2],
			history
				.map(function pair(point) {
					return `${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
				})
				.join(" "),
		);
		element.style.setProperty(names[3], String(Math.min(60, (Math.hypot(dx, dy) * 16.67) / delta)));
		element.style.setProperty(names[4], press.toFixed(3));
		if (!reduced.matches && (now < until || x !== targetX || y !== targetY || press !== targetPress)) schedule();
	}
	/** Accept a pointer position without stealing scrolling or pointer capture. @param event Pointer event. */
	function move(event: PointerEvent): void {
		if (event.pointerType === "touch" && !options.touch) return;
		clientX = event.clientX;
		clientY = event.clientY;
		if (!initialized) {
			const rect = element.getBoundingClientRect();
			if (!rect.width || !rect.height) return;
			x = ((clientX - rect.left) * element.offsetWidth) / rect.width;
			y = ((clientY - rect.top) * element.offsetHeight) / rect.height;
			initialized = true;
		}
		until = view!.performance.now() + limit * 18;
		schedule();
	}
	/** Compress the visual material while pressing. @param event Pointer event. */
	function down(event: PointerEvent): void {
		if (event.pointerType === "touch" && !options.touch) return;
		move(event);
		targetPress = 1;
		schedule();
	}
	/** Release pressure even when the pointer leaves the element. */
	function release(): void {
		targetPress = 0;
		schedule();
	}
	/** Discard decorative history when reduced motion is requested. */
	function preference(): void {
		history = [];
		until = 0;
		schedule();
	}
	/** Suspend frame writes in hidden documents. */
	function visibility(): void {
		if (element.ownerDocument.hidden) {
			if (frame) view!.cancelAnimationFrame(frame);
			frame = 0;
			targetPress = 0;
		} else {
			lastTime = 0;
			schedule();
		}
	}
	element.addEventListener("pointermove", move, { passive: true });
	element.addEventListener("pointerdown", down, { passive: true });
	element.addEventListener("pointerleave", release);
	view.addEventListener("pointerup", release);
	view.addEventListener("pointercancel", release);
	view.addEventListener("blur", release);
	reduced.addEventListener("change", preference);
	element.ownerDocument.addEventListener("visibilitychange", visibility);
	return function cleanup(): void {
		if (disposed) return;
		disposed = true;
		element.removeEventListener("pointermove", move);
		element.removeEventListener("pointerdown", down);
		element.removeEventListener("pointerleave", release);
		view.removeEventListener("pointerup", release);
		view.removeEventListener("pointercancel", release);
		view.removeEventListener("blur", release);
		reduced.removeEventListener("change", preference);
		element.ownerDocument.removeEventListener("visibilitychange", visibility);
		if (frame) view.cancelAnimationFrame(frame);
		for (let i = 0; i < names.length; i++) {
			if (previous[i].value) element.style.setProperty(names[i], previous[i].value, previous[i].priority);
			else element.style.removeProperty(names[i]);
		}
	};
}
