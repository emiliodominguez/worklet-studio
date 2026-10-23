import assert from "node:assert/strict";
import { test } from "node:test";
import { camera, clipNear, dot, project, toCamera } from "../packages/architecture-worklet/src/geometry.ts";
import { createScene } from "../packages/architecture-worklet/src/scene.ts";
import { paint } from "../packages/architecture-worklet/src/renderer.ts";
import type { PaintContext } from "../packages/core/src/types.ts";

test("architecture: camera projects the look-at point to the center with an orthogonal basis", function projection() {
	const view = camera([-3, 4, -12], [0, 10, 40], 800, 600);
	const point = project(toCamera([0, 10, 40], view), view);
	assert.ok(Math.abs(point[0] - 400) < 1e-8);
	assert.ok(Math.abs(point[1] - 300) < 1e-8);
	assert.ok(Math.abs(dot(view.up, view.forward)) < 1e-8);
	assert.ok(Math.abs(dot(view.right, view.forward)) < 1e-8);
});

test("architecture: polygons crossing the eye are clipped before perspective division", function clipping() {
	const clipped = clipNear([
		[-1, -1, -1],
		[1, -1, 1],
		[1, 1, 1],
		[-1, 1, -1],
	]);
	assert.equal(clipped.length, 4);
	assert.ok(
		clipped.every(function inFront(point) {
			return point[2] >= 0.35;
		}),
	);
	assert.deepEqual(
		clipNear([
			[-1, -1, -1],
			[1, -1, -1],
			[0, 1, -1],
		]),
		[],
	);
});

test("architecture: mesh is bounded, finite and uses unit surface normals", function mesh() {
	const faces = createScene();
	assert.ok(faces.length > 1000 && faces.length < 5000);
	for (const face of faces) {
		assert.equal(face.points.length, 4);
		assert.ok(face.points.flat().every(Number.isFinite));
		assert.ok(Math.abs(Math.hypot(...face.normal) - 1) < 1e-9);
	}
});

test("architecture: camera route, disassembly, portrait framing and malformed settings stay finite and bounded", function bounds() {
	let operations = 0;
	const ctx = new Proxy(
		{},
		{
			get(_target, name: string) {
				return function operation(...args: unknown[]) {
					operations++;
					for (const arg of args) if (typeof arg === "number") assert.ok(Number.isFinite(arg), `${name}: ${arg}`);
					if (name.startsWith("create"))
						return {
							addColorStop(position: number) {
								assert.ok(position >= 0 && position <= 1);
							},
						};
				};
			},
			set() {
				return true;
			},
		},
	) as PaintContext;
	for (const travel of [0, 0.25, 0.5, 0.75, 1, 1e20, "NaN"])
		for (const explode of [0, 0.5, 1]) {
			operations = 0;
			paint(
				ctx,
				{ width: 390, height: 844 },
				new Map<string, string | number>([
					["--architecture-travel", travel],
					["--architecture-explode", explode],
					["--worklet-pointer-x", 1],
					["--worklet-pointer-y", 0],
				]),
			);
			assert.ok(operations > 100 && operations < 70000, `Unbounded paint: ${operations}`);
		}
});
