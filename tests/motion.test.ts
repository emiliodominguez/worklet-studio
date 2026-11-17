import assert from "node:assert/strict";
import { test } from "node:test";
import { experiments } from "../apps/playground/src/catalog.ts";
import { ease, elapsed, frequency, inlinePoint, settled, spring, stepSpring } from "../packages/core/src/motion.ts";
import { attachView } from "../packages/core/src/interaction.ts";
import { attachPointer } from "../packages/cursor-worklet/src/register.ts";
import { paint as cursor } from "../packages/cursor-worklet/src/renderer.ts";
import { anchorTrail, resampleTrail } from "../packages/cursor-worklet/src/trails.ts";
import type { PaintContext, Painter } from "../packages/core/src/types.ts";

const TAU = Math.PI * 2;

/**
 * Build a deterministic DOM, timer and animation-frame harness.
 * @returns Element, window, inline values, and drivers for frames, timers and events.
 */
function harness() {
	const values = new Map<string, string>();
	const frames = new Map<number, FrameRequestCallback>();
	const timers = new Map<number, () => void>();
	let identifier = 0,
		now = 0;
	const media = Object.assign(new EventTarget(), { matches: false });
	const view = Object.assign(new EventTarget(), {
		matchMedia() {
			return media;
		},
		requestAnimationFrame(callback: FrameRequestCallback) {
			frames.set(++identifier, callback);
			return identifier;
		},
		cancelAnimationFrame(id: number) {
			frames.delete(id);
		},
		setTimeout(callback: () => void) {
			timers.set(++identifier, callback);
			return identifier;
		},
		clearTimeout(id: number) {
			timers.delete(id);
		},
	});
	const document = Object.assign(new EventTarget(), { defaultView: view, hidden: false });
	const element = Object.assign(new EventTarget(), {
		ownerDocument: document,
		offsetWidth: 1000,
		offsetHeight: 800,
		style: {
			getPropertyValue(name: string) {
				return values.get(name) || "";
			},
			getPropertyPriority() {
				return "";
			},
			setProperty(name: string, value: string) {
				values.set(name, value);
			},
			removeProperty(name: string) {
				values.delete(name);
			},
		},
		getBoundingClientRect() {
			return { left: 0, top: 0, width: 1000, height: 800 };
		},
	});
	/**
	 * Run one queued animation frame.
	 * @returns Whether a frame ran.
	 */
	function frame(): boolean {
		if (!frames.size) return false;
		const pending = [...frames.values()];
		frames.clear();
		now += 16.67;
		for (const callback of pending) callback(now);
		return true;
	}
	/**
	 * Drain the animation queue with a hard limit to catch perpetual loops.
	 * @param limit Maximum frames.
	 * @returns Frames run.
	 */
	function settle(limit = 600): number {
		let count = 0;
		while (count < limit && frame()) count++;
		assert.equal(frames.size, 0, "Animation must stop when settled");
		return count;
	}
	/** Fire every pending timer. */
	function elapse(): void {
		const pending = [...timers.values()];
		timers.clear();
		for (const callback of pending) callback();
	}
	/**
	 * Dispatch a synthetic DOM event.
	 * @param target Event target.
	 * @param type Event name.
	 * @param properties Event fields.
	 */
	function dispatch(target: EventTarget, type: string, properties = {}): void {
		target.dispatchEvent(Object.assign(new Event(type), properties));
	}
	return { element: element as unknown as HTMLElement, view, values, frame, settle, elapse, dispatch, frames, timers };
}

/**
 * Record every number a painter passes to the context, including those embedded in color strings.
 * @param painter Painter to invoke.
 * @param values CSS inputs.
 * @returns Operation names and the numeric stream.
 */
function record(painter: Painter, values: Record<string, string | number>): { ops: string[]; numbers: number[] } {
	const ops: string[] = [],
		numbers: number[] = [];
	/**
	 * Store one operation.
	 * @param name Operation.
	 * @param args Arguments.
	 */
	function push(name: string, args: unknown[]): void {
		ops.push(name);
		for (const value of args) {
			if (typeof value === "number") numbers.push(value);
			else if (typeof value === "string") for (const match of value.matchAll(/-?\d+(\.\d+)?(e-?\d+)?/g)) numbers.push(Number(match[0]));
		}
	}
	const gradient = {
		addColorStop(offset: number, color: string) {
			push("colorStop", [offset, color]);
		},
	};
	const ctx = new Proxy(
		{},
		{
			get(_target, name: string) {
				return function operation(...args: unknown[]) {
					push(name, args);
					if (name.startsWith("create")) return gradient;
				};
			},
			set(_target, name: string, value) {
				push(name, [typeof value === "object" ? "" : value]);
				return true;
			},
		},
	) as PaintContext;
	const inputs = new Map<string, string>();
	for (const [key, value] of Object.entries(values)) inputs.set(key, String(value));
	painter(ctx, { width: 640, height: 400 }, inputs);
	return { ops, numbers };
}

/**
 * Compare two numbers as equal, or as the same angle.
 * @param a First value.
 * @param b Second value.
 * @returns Whether they match.
 */
function same(a: number, b: number): boolean {
	const difference = Math.abs(a - b);
	return difference < 1e-6 || Math.abs(difference / TAU - Math.round(difference / TAU)) < 1e-6;
}

/**
 * Reduce a value to a whole-turn-invariant key.
 * @param value Number.
 * @returns Value modulo one turn, rounded to suppress floating-point noise.
 */
function wrap(value: number): number {
	const turn = Math.round((((value % TAU) + TAU) % TAU) * 1e6) / 1e6;
	return turn >= Math.round(TAU * 1e6) / 1e6 ? 0 : turn;
}

/**
 * Numeric sort order.
 * @param a First value.
 * @param b Second value.
 * @returns Negative, zero or positive.
 */
function ascending(a: number, b: number): number {
	return a - b;
}

test("springs are frame-rate independent, start without a kink and settle", function springs() {
	const stiffness = frequency(8);
	const coarse = spring(0),
		fine = spring(0);
	for (let i = 0; i < 4; i++) stepSpring(coarse, 1, stiffness, elapsed(32, 0));
	for (let i = 0; i < 32; i++) stepSpring(fine, 1, stiffness, elapsed(4, 0));
	assert.ok(Math.abs(coarse.value - fine.value) < 1e-9);
	assert.ok(Math.abs(coarse.velocity - fine.velocity) < 1e-9);
	const start = spring(0);
	stepSpring(start, 1, stiffness, elapsed(4, 0));
	assert.ok(start.value < 0.001, "A critically damped spring eases in from rest");
	const resting = spring(0);
	let peak = 0;
	for (let i = 0; i < 240; i++) {
		stepSpring(resting, 1, stiffness, elapsed(16.67, undefined));
		peak = Math.max(peak, resting.value);
	}
	assert.ok(peak <= 1 + 1e-9, "Critical damping never overshoots");
	assert.ok(settled(resting, 1, 0.0005));
	assert.ok(Math.abs(ease(0.3, elapsed(33.34, 0)) - (1 - 0.7 * 0.7)) < 1e-9);
});

test("spring inputs reject values that would stall or diverge", function springInputs() {
	for (const invalid of [0, -1, Number.NaN, Number.POSITIVE_INFINITY])
		assert.throws(function create() {
			frequency(invalid);
		}, RangeError);
	assert.equal(elapsed(100, 200), 0.001, "Time running backwards still advances by the shortest frame");
	assert.equal(elapsed(5000, 0), 0.064, "A stalled tab resumes with at most one long frame");
	assert.equal(elapsed(16, undefined), 0.01667, "The first frame after a pause assumes 60 Hz");
	assert.equal(elapsed(Number.NaN, 0), 0.01667);
	assert.deepEqual(inlinePoint(harness().element, "--x", "--y"), undefined);
});

test("view: a short exit holds the scene, then it relaxes to center without snapping", function viewLeave() {
	const h = harness();
	const cleanup = attachView(h.element);
	h.dispatch(h.element, "pointermove", { clientX: 900, clientY: 80 });
	h.settle();
	assert.equal(h.values.get("--worklet-pointer-x"), "0.9000");
	h.dispatch(h.element, "pointerleave");
	assert.equal(h.frames.size, 0, "Leaving does not move the scene immediately");
	h.dispatch(h.element, "pointermove", { clientX: 900, clientY: 80 });
	assert.equal(h.timers.size, 0, "Returning cancels the pending relax");
	h.dispatch(h.element, "pointerleave");
	h.elapse();
	let last = 0.9,
		largest = 0;
	while (h.frame()) {
		const x = Number(h.values.get("--worklet-pointer-x"));
		largest = Math.max(largest, last - x);
		assert.ok(x <= last + 1e-9, "The return is monotonic");
		last = x;
	}
	assert.equal(h.values.get("--worklet-pointer-x"), "0.5000");
	assert.ok(largest < 0.02, `No frame jumps more than 2% of the surface (largest ${largest})`);
	cleanup();
	assert.equal(h.values.has("--worklet-pointer-x"), false);
});

test("view: a new helper continues from the inline view a previous one left", function viewContinuity() {
	const h = harness();
	h.values.set("--worklet-pointer-x", "0.2");
	h.values.set("--worklet-pointer-y", "0.7");
	const cleanup = attachView(h.element);
	h.dispatch(h.element, "pointermove", { clientX: 200, clientY: 560 });
	h.frame();
	assert.equal(h.values.get("--worklet-pointer-x"), "0.2000");
	h.settle();
	cleanup();
	assert.equal(h.values.get("--worklet-pointer-x"), "0.2");
});

test("cursor: the trail reels in smoothly, keeps the travel heading and stops scheduling", function trailSettles() {
	const h = harness();
	const cleanup = attachPointer(h.element, { smoothing: 0.24, trail: 32 });
	for (let x = 100; x <= 700; x += 30) {
		h.dispatch(h.element, "pointermove", { clientX: x, clientY: 400 });
		h.frame();
	}
	/**
	 * Measure the published trail length.
	 * @returns Length in CSS pixels.
	 */
	function length(): number {
		const parts = (h.values.get("--cursor-trail") || "").split(" ").map(Number);
		let total = 0;
		for (let i = 2; i + 1 < parts.length; i += 2) total += Math.hypot(parts[i] - parts[i - 2], parts[i + 1] - parts[i - 1]);
		return total;
	}
	assert.ok(length() > 100, "Moving draws a long trail");
	assert.ok(Math.abs(Number(h.values.get("--cursor-heading"))) < 0.01, "Heading follows horizontal travel");
	let previous = length();
	while (h.frame()) {
		const current = length();
		assert.ok(Math.abs(previous - current) < 40, "The trail never collapses or jumps in one frame");
		previous = current;
	}
	assert.equal(length(), 0);
	assert.equal(h.values.get("--cursor-speed"), "0.00");
	assert.ok(Math.abs(Number(h.values.get("--cursor-heading"))) < 0.01, "The heading survives the stop for the idle tail");
	cleanup();
	assert.equal(h.values.size, 0);
});

test("cursor: a new helper keeps the light where the previous one left it", function pointerContinuity() {
	const h = harness();
	h.values.set("--cursor-position-x", "300");
	h.values.set("--cursor-position-y", "200");
	h.values.set("--cursor-heading", "1.5");
	const cleanup = attachPointer(h.element, { smoothing: 0.24 });
	h.dispatch(h.element, "pointermove", { clientX: 900, clientY: 700 });
	h.frame();
	assert.ok(Number(h.values.get("--cursor-position-x")) < 500, "The head glides from its previous position");
	h.settle();
	assert.equal(h.values.get("--cursor-position-x"), "900.00");
	cleanup();
	assert.equal(h.values.get("--cursor-position-x"), "300");
});

test("cursor: a trail reeling in blends into the idle tail without a pop", function wispContinuity() {
	for (const mode of ["ribbon", "comet"]) {
		let previous: number[] | undefined;
		for (let reach = 400; reach >= 0; reach -= 4) {
			const trail = Array.from({ length: 24 }, function point(_, i) {
				return `${(300 - (reach * i) / 23).toFixed(2)} 200`;
			}).join(" ");
			const output = record(cursor, {
				"--cursor-mode": mode,
				"--cursor-size": 38,
				"--cursor-position-x": 300,
				"--cursor-position-y": 200,
				"--cursor-trail": trail,
			});
			if (previous && previous.length === output.numbers.length) {
				let largest = 0;
				for (let i = 0; i < previous.length; i++) largest = Math.max(largest, Math.abs(previous[i] - output.numbers[i]));
				assert.ok(largest < 40, `${mode}: ${reach}px trail changed by ${largest}`);
			}
			previous = output.numbers;
		}
	}
});

test("resampled trails are evenly spaced and keep their ends", function resample() {
	const points = resampleTrail(
		[
			{ x: 0, y: 0 },
			{ x: 1, y: 0 },
			{ x: 10, y: 0 },
		],
		11,
	);
	assert.equal(points.length, 11);
	for (let i = 0; i < points.length; i++) assert.ok(Math.abs(points[i].x - i) < 1e-9);
	assert.throws(function single() {
		resampleTrail([{ x: 0, y: 0 }], 1);
	}, RangeError);
	assert.deepEqual(anchorTrail([], { x: 4, y: 5 }), [{ x: 4, y: 5 }]);
	assert.deepEqual(resampleTrail([{ x: 4, y: 5 }], 3), [
		{ x: 4, y: 5 },
		{ x: 4, y: 5 },
		{ x: 4, y: 5 },
	]);
});

test("every preset loops seamlessly", async function loops() {
	for (const effect of experiments) {
		const { paint } = (await import(`../packages/${effect.id}-worklet/src/renderer.ts`)) as { paint: Painter };
		for (const preset of effect.presets) {
			const values: Record<string, string | number> = {};
			for (const control of effect.controls) values[control.property] = control.value;
			Object.assign(values, preset.values);
			const start = record(paint, { ...values, "--worklet-time": 0 }),
				end = record(paint, { ...values, "--worklet-time": 1 });
			const label = `${effect.id} / ${preset.name}`;
			assert.equal(end.numbers.length, start.numbers.length, label);
			const ordered = start.numbers.every(function match(value, i) {
				return same(value, end.numbers[i]);
			});
			if (ordered) continue;
			// Depth-sorted geometry may legitimately swap equal-depth pieces, and angles may differ by whole turns; the drawn set must still match.
			const a = start.numbers.map(wrap).sort(ascending),
				b = end.numbers.map(wrap).sort(ascending);
			assert.ok(
				a.every(function match(value, i) {
					return Math.abs(value - b[i]) < 1e-5;
				}),
				`${label} jumps when the loop restarts`,
			);
		}
	}
});
