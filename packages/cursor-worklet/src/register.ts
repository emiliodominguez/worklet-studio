import { ease, elapsed, inline, inlinePoint } from "../../core/src/motion.ts";
import type { Point } from "../../core/src/motion.ts";
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
		return { name, value: element.style.getPropertyValue(name), priority: element.style.getPropertyPriority(name) };
	});
	const smoothing = Number.isFinite(options.smoothing) ? Math.max(0.05, Math.min(1, options.smoothing!)) : 1;
	const limit = Number.isFinite(options.trail) ? Math.max(2, Math.min(32, Math.floor(options.trail!))) : 24;
	const reduced = view.matchMedia("(prefers-reduced-motion: reduce)");
	/** Where a previous helper left the light; the first pointer move glides from here instead of jumping. */
	const start = inlinePoint(element, names[0], names[1]);
	const startHeading = inline(element, names[5]) ?? 0;
	/** Unit vector of travel; the idle tail streams opposite to it. */
	const heading: Point = { x: Math.cos(startHeading), y: Math.sin(startHeading) };
	let frame = 0,
		speed = 0,
		press = 0,
		targetPress = 0,
		disposed = false;
	let lastTime: number | undefined;
	/** The latest pointer in client coordinates and the light chasing it; absent until the first pointer arrives. */
	let tracking: { client: Point; head: Point } | undefined;
	let chain: Point[] = [];

	/** Schedule a frame only while the document is visible. */
	function schedule(): void {
		if (!frame && !disposed && !element.ownerDocument.hidden) frame = view!.requestAnimationFrame(update);
	}
	/** Convert client coordinates into the element's CSS pixel space. @param point Client coordinates. @returns Local position, or undefined for an empty box. */
	function local(point: Point): Point | undefined {
		const rect = element.getBoundingClientRect();
		if (rect.width <= 0 || rect.height <= 0) return undefined;
		return { x: ((point.x - rect.left) * element.offsetWidth) / rect.width, y: ((point.y - rect.top) * element.offsetHeight) / rect.height };
	}
	/** Pull each trail link toward its leader, head first. @param lead The light's position. @param fraction Frame-rate corrected follow fraction. @returns Largest remaining gap between neighbors. */
	function reel(lead: Point, fraction: number): number {
		const length = reduced.matches ? 1 : limit;
		while (chain.length < length) chain.push({ ...lead });
		chain.length = length;
		chain[0].x = lead.x;
		chain[0].y = lead.y;
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
		if (disposed || !tracking || element.ownerDocument.hidden) return;
		const { client, head } = tracking;
		const target = local(client);
		if (!target) return;
		const seconds = elapsed(now, lastTime);
		lastTime = now;
		const instant = reduced.matches;
		const factor = instant ? 1 : ease(smoothing, seconds);
		const dx = (target.x - head.x) * factor,
			dy = (target.y - head.y) * factor;
		head.x += dx;
		head.y += dy;
		if (Math.hypot(target.x - head.x, target.y - head.y) < 0.05) {
			head.x = target.x;
			head.y = target.y;
		}
		const moved = Math.hypot(dx, dy);
		const measured = instant ? 0 : Math.min(60, moved / (seconds * 60));
		speed += (measured - speed) * ease(SPEED_FOLLOW, seconds);
		if (speed < 0.01) speed = 0;
		if (moved > 0.25 && !instant) {
			const turn = ease(HEADING_FOLLOW, seconds);
			heading.x += (dx / moved - heading.x) * turn;
			heading.y += (dy / moved - heading.y) * turn;
			const norm = Math.hypot(heading.x, heading.y) || 1;
			heading.x /= norm;
			heading.y /= norm;
		}
		press += (targetPress - press) * (instant ? 1 : ease(PRESS_FOLLOW, seconds));
		if (Math.abs(targetPress - press) < 0.001) press = targetPress;
		const gap = reel(head, instant ? 1 : ease(LINK_FOLLOW, seconds));
		if (gap < 0.05) {
			for (const link of chain) {
				link.x = head.x;
				link.y = head.y;
			}
		}
		element.style.setProperty(names[0], head.x.toFixed(2));
		element.style.setProperty(names[1], head.y.toFixed(2));
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
		element.style.setProperty(names[5], Math.atan2(heading.y, heading.x).toFixed(3));
		const moving = head.x !== target.x || head.y !== target.y || gap >= 0.05 || speed > 0 || press !== targetPress;
		if (moving && !instant) schedule();
		else lastTime = undefined;
	}
	/** Accept a pointer position without stealing scrolling or pointer capture. @param event Pointer event. */
	function move(event: PointerEvent): void {
		if (event.pointerType === "touch" && !options.touch) return;
		const client = { x: event.clientX, y: event.clientY };
		if (tracking) tracking.client = client;
		else {
			// The light glides from where a previous helper left it, or appears under the first pointer.
			const head = start ? { ...start } : local(client);
			if (!head) return;
			tracking = { client, head };
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
			lastTime = undefined;
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
		for (const { name, value, priority } of previous) {
			if (value) element.style.setProperty(name, value, priority);
			else element.style.removeProperty(name);
		}
	};
}
