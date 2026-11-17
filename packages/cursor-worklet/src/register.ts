import { ease, inline } from "../../core/src/motion.ts";
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
	/** Trail links for ribbon/comet modes, 2–32. Default 24. */
	trail?: number;
}

/** Fraction of the gap to its leader that each trail link closes per 60 Hz frame. Cascading this lag gives the trail its silk-like curvature and lets it reel in smoothly once the pointer stops. */
const LINK_FOLLOW = 0.55;
/** Fraction of the gap to the measured speed closed per 60 Hz frame. */
const SPEED_FOLLOW = 0.18;
/** Fraction of the gap to the travel direction closed per 60 Hz frame. */
const HEADING_FOLLOW = 0.2;
/** Fraction of the gap to the press target closed per 60 Hz frame. */
const PRESS_FOLLOW = 0.3;

/** Track local pointer position, a lagging trail, smoothed speed and heading, and press state. Respects reduced motion, stops when settled, and continues from a position a previous helper left inline. @param element Painted element. @param options Pointer behavior. @returns Idempotent cleanup restoring all previous inline values. */
export function attachPointer(element: HTMLElement, options: PointerOptions = {}): () => void {
	const view = element.ownerDocument.defaultView;
	if (!view) return function noop() {};
	const names = ["--cursor-position-x", "--cursor-position-y", "--cursor-trail", "--cursor-speed", "--cursor-press", "--cursor-heading"];
	const previous = names.map(function read(name) {
		return { value: element.style.getPropertyValue(name), priority: element.style.getPropertyPriority(name) };
	});
	const smoothing = Number.isFinite(options.smoothing) ? Math.max(0.05, Math.min(1, options.smoothing!)) : 1;
	const limit = Number.isFinite(options.trail) ? Math.max(2, Math.min(32, Math.floor(options.trail!))) : 24;
	const reduced = view.matchMedia("(prefers-reduced-motion: reduce)");
	const startX = inline(element, names[0]),
		startY = inline(element, names[1]),
		startHeading = inline(element, names[5]) ?? 0;
	let frame = 0,
		lastTime = 0,
		clientX = 0,
		clientY = 0,
		x = startX ?? 0,
		y = startY ?? 0,
		speed = 0,
		headingX = Math.cos(startHeading),
		headingY = Math.sin(startHeading),
		press = 0,
		targetPress = 0;
	let initialized = false,
		disposed = false;
	let chain: { x: number; y: number }[] = [];

	/** Schedule a frame only while the document is visible. */
	function schedule(): void {
		if (!frame && !disposed && !element.ownerDocument.hidden) frame = view!.requestAnimationFrame(update);
	}
	/** Convert the latest client coordinates into the element's CSS pixel space. @returns Local target, or undefined for an empty box. */
	function local(): { x: number; y: number } | undefined {
		const rect = element.getBoundingClientRect();
		if (rect.width <= 0 || rect.height <= 0) return undefined;
		return { x: ((clientX - rect.left) * element.offsetWidth) / rect.width, y: ((clientY - rect.top) * element.offsetHeight) / rect.height };
	}
	/** Pull each trail link toward its leader, head first. @param fraction Frame-rate corrected follow fraction. @returns Largest remaining gap between neighbors. */
	function reel(fraction: number): number {
		const length = reduced.matches ? 1 : limit;
		while (chain.length < length) chain.push({ x, y });
		chain.length = length;
		chain[0].x = x;
		chain[0].y = y;
		let gap = 0;
		for (let i = 1; i < chain.length; i++) {
			const link = chain[i],
				leader = chain[i - 1];
			link.x += (leader.x - link.x) * fraction;
			link.y += (leader.y - link.y) * fraction;
			gap = Math.max(gap, Math.abs(leader.x - link.x), Math.abs(leader.y - link.y));
		}
		return gap;
	}
	/** Advance smoothing and publish bounded, finite CSS inputs. @param now Animation timestamp. */
	function update(now: number): void {
		frame = 0;
		if (disposed || !initialized || element.ownerDocument.hidden) return;
		const target = local();
		if (!target) return;
		const delta = lastTime ? Math.min(64, Math.max(1, now - lastTime)) : 16.67;
		lastTime = now;
		const instant = reduced.matches;
		const factor = instant ? 1 : ease(smoothing, delta);
		const dx = (target.x - x) * factor,
			dy = (target.y - y) * factor;
		x += dx;
		y += dy;
		if (Math.hypot(target.x - x, target.y - y) < 0.05) {
			x = target.x;
			y = target.y;
		}
		const moved = Math.hypot(dx, dy);
		const measured = instant ? 0 : Math.min(60, (moved * 16.67) / delta);
		speed += (measured - speed) * ease(SPEED_FOLLOW, delta);
		if (speed < 0.01) speed = 0;
		if (moved > 0.25 && !instant) {
			const turn = ease(HEADING_FOLLOW, delta);
			headingX += (dx / moved - headingX) * turn;
			headingY += (dy / moved - headingY) * turn;
			const norm = Math.hypot(headingX, headingY) || 1;
			headingX /= norm;
			headingY /= norm;
		}
		press += (targetPress - press) * (instant ? 1 : ease(PRESS_FOLLOW, delta));
		if (Math.abs(targetPress - press) < 0.001) press = targetPress;
		const gap = reel(instant ? 1 : ease(LINK_FOLLOW, delta));
		if (gap < 0.05) {
			for (const link of chain) {
				link.x = x;
				link.y = y;
			}
		}
		element.style.setProperty(names[0], x.toFixed(2));
		element.style.setProperty(names[1], y.toFixed(2));
		element.style.setProperty(
			names[2],
			chain
				.map(function pair(point) {
					return `${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
				})
				.join(" "),
		);
		element.style.setProperty(names[3], speed.toFixed(2));
		element.style.setProperty(names[4], press.toFixed(3));
		element.style.setProperty(names[5], Math.atan2(headingY, headingX).toFixed(3));
		const moving = x !== target.x || y !== target.y || gap >= 0.05 || speed > 0 || press !== targetPress;
		if (moving && !instant) schedule();
		else lastTime = 0;
	}
	/** Accept a pointer position without stealing scrolling or pointer capture. @param event Pointer event. */
	function move(event: PointerEvent): void {
		if (event.pointerType === "touch" && !options.touch) return;
		clientX = event.clientX;
		clientY = event.clientY;
		if (!initialized) {
			const target = local();
			if (!target) return;
			if (startX === undefined || startY === undefined) {
				x = target.x;
				y = target.y;
			}
			chain = [];
			initialized = true;
		}
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
	/** Collapse decorative history when reduced motion is requested. */
	function preference(): void {
		chain = [];
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
