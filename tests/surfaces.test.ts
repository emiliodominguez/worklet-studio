import assert from "node:assert/strict";
import { test } from "node:test";
import { contourPath } from "../packages/metaballs-worklet/src/contours.ts";
import { noise, fractal } from "../packages/core/src/noise.ts";
import { spectrum, surface } from "../packages/core/src/surface.ts";
import type { PaintContext } from "../packages/core/src/types.ts";

/** Trace a synthetic field and validate its geometry. @param sample Scalar field. @returns Number of closed silhouettes. */
function contours(sample: (x: number, y: number) => number): number {
	const n = 64,
		field = new Float32Array((n + 1) ** 2);
	for (let row = 1; row < n; row++) for (let column = 1; column < n; column++) field[row * (n + 1) + column] = sample(column / n, row / n);
	let closed = 0;
	const ctx = new Proxy(
		{},
		{
			get(_target, method) {
				return function operation(...args: number[]) {
					assert.ok(args.every(Number.isFinite));
					if (method === "closePath") closed++;
				};
			},
		},
	) as PaintContext;
	const count = contourPath(ctx, field, n, n, 800, 500, 1);
	assert.equal(count, closed);
	return count;
}

test("implicit silhouettes preserve separate droplets, merges, and interior holes", function topology() {
	assert.equal(
		contours(function separate(x, y) {
			return Math.max(0.012 / ((x - 0.25) ** 2 + (y - 0.5) ** 2 + 0.001), 0.012 / ((x - 0.75) ** 2 + (y - 0.5) ** 2 + 0.001));
		}),
		2,
	);
	assert.equal(
		contours(function merged(x, y) {
			return 0.08 / ((x - 0.35) ** 2 + (y - 0.5) ** 2 + 0.001) + 0.08 / ((x - 0.65) ** 2 + (y - 0.5) ** 2 + 0.001);
		}),
		1,
	);
	assert.equal(
		contours(function hole(x, y) {
			return 2 - Math.abs(Math.hypot(x - 0.5, y - 0.5) - 0.25) * 15;
		}),
		2,
	);
});

test("noise stays continuous, seeded, and bounded across lattice boundaries", function continuousNoise() {
	for (let i = -30; i <= 30; i++) {
		assert.ok(Math.abs(noise(i - 1e-6, 0.7, 42) - noise(i + 1e-6, 0.7, 42)) < 1e-5);
		assert.ok(Math.abs(fractal(i * 0.13, i * 0.17, 42)) <= 1);
	}
	assert.notEqual(noise(0.3, 0.7, 42), noise(0.3, 0.7, 17));
});

test("surface work is bounded at full-screen and extreme dimensions", function budget() {
	let samples = 0,
		rectangles = 0;
	const ctx = new Proxy(
		{},
		{
			get(_target, name) {
				return function operation() {
					if (name === "fillRect") rectangles++;
					if (name === "createLinearGradient") return { addColorStop() {} };
				};
			},
		},
	) as PaintContext;
	surface(
		ctx,
		{ width: 100000, height: 100000 },
		function shade() {
			samples++;
			return spectrum(220, 10);
		},
		160,
	);
	assert.ok(samples <= 161 ** 2);
	assert.ok(rectangles < 4000);
	assert.equal(spectrum(220, 0), "rgba(0,0,0,1)");
});
