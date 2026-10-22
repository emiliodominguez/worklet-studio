import assert from "node:assert/strict";
import { test } from "node:test";
import { paint as aurora } from "../packages/aurora-worklet/src/renderer.ts";
import { paint as particles } from "../packages/particles-worklet/src/renderer.ts";
import { paint as cursor } from "../packages/cursor-worklet/src/renderer.ts";
import { paint as flow } from "../packages/flow-field-worklet/src/renderer.ts";
import { paint as ripple } from "../packages/ripple-worklet/src/renderer.ts";
import { paint as iridescence } from "../packages/iridescence-worklet/src/renderer.ts";
import { color, number, random } from "../packages/core/src/index.ts";
import { loadWorklet } from "../packages/core/src/register.ts";
import type { PaintContext, Painter } from "../packages/core/src/types.ts";

import { paint as caustics } from "../packages/caustics-worklet/src/renderer.ts";
import { paint as vortex } from "../packages/vortex-worklet/src/renderer.ts";
import { paint as terrain } from "../packages/terrain-worklet/src/renderer.ts";
const painters = { aurora, particles, cursor, flow, ripple, iridescence, caustics, vortex, terrain };

/** Record the supported paint operations and reject invalid geometry. @param painter Painter to invoke. @param values CSS inputs. @param width Surface width. @param height Surface height. @returns Recorded operations. */
function render(painter: Painter, values: Record<string, string | number> = {}, width = 800, height = 500): unknown[][] {
	const commands: unknown[][] = [];
	const methods = new Set([
		"beginPath",
		"moveTo",
		"lineTo",
		"quadraticCurveTo",
		"closePath",
		"arc",
		"ellipse",
		"fill",
		"stroke",
		"fillRect",
		"save",
		"restore",
		"translate",
		"rotate",
		"createLinearGradient",
		"createRadialGradient",
	]);
	const attributes = new Set(["fillStyle", "strokeStyle", "globalAlpha", "globalCompositeOperation", "lineWidth", "lineCap", "lineJoin"]);
	const ctx = new Proxy(
		{},
		{
			get(_target, name: string) {
				assert.ok(methods.has(name), `Unsupported Paint API: ${name}`);
				return function operation(...args: unknown[]) {
					for (const value of args) if (typeof value === "number") assert.ok(Number.isFinite(value), `${name} received ${value}`);
					if (name === "arc") assert.ok(Number(args[2]) >= 0);
					if (name === "ellipse") assert.ok(Number(args[2]) >= 0 && Number(args[3]) >= 0);
					commands.push([name, ...args]);
					if (name.startsWith("create"))
						return {
							addColorStop(position: number, value: string) {
								assert.ok(position >= 0 && position <= 1);
								commands.push(["colorStop", position, value]);
							},
						};
				};
			},
			set(_target, name: string, value) {
				assert.ok(attributes.has(name), `Unsupported Paint attribute: ${name}`);
				if (typeof value === "number") assert.ok(Number.isFinite(value));
				if (name === "lineWidth") assert.ok(value > 0, "Canvas ignores non-positive line widths");
				commands.push([name, typeof value === "object" ? "gradient" : value]);
				return true;
			},
		},
	) as PaintContext;
	painter(ctx, { width, height }, new Map(Object.entries(values)));
	return commands;
}

for (const [name, painter] of Object.entries(painters)) {
	test(`${name}: defaults paint deterministically with finite geometry`, function defaults() {
		const first = render(painter);
		assert.ok(first.length > 20);
		assert.deepEqual(render(painter), first);
		assert.equal(
			first.filter(function save(c) {
				return c[0] === "save";
			}).length,
			first.filter(function restore(c) {
				return c[0] === "restore";
			}).length,
		);
	});
	test(`${name}: zero-size and nonfinite surfaces do no work`, function empty() {
		assert.deepEqual(render(painter, {}, 0, 500), []);
		assert.deepEqual(render(painter, {}, 300, Number.NaN), []);
	});
	test(`${name}: malformed shared properties fall back safely`, function malformed() {
		assert.deepEqual(render(painter, { "--worklet-time": "invalid", "--worklet-seed": "NaN", "--worklet-hue": "Infinity" }), render(painter));
	});
}

test("random seeds are repeatable and stay in range", function seeded() {
	const a = random(12),
		b = random(12);
	for (let i = 0; i < 500; i++) {
		const value = a();
		assert.equal(value, b());
		assert.ok(value >= 0 && value < 1);
	}
});
test("numeric inputs handle zeros, units, malformed values, and bounds", function parsing() {
	const props = new Map([
		["zero", "0"],
		["units", "12px"],
		["huge", "1e20"],
		["bad", "Infinity"],
	]);
	assert.equal(number(props, "zero", 5), 0);
	assert.equal(number(props, "units", 5), 12);
	assert.equal(number(props, "huge", 5, 0, 100), 100);
	assert.equal(number(props, "bad", 5), 5);
});
test("legacy cursor colors accept RGB triplets and CSS colors", function legacyColors() {
	assert.equal(color("255, 128, 0"), "rgb(255, 128, 0)");
	assert.equal(color("#fff"), "#fff");
	const result = render(cursor, { "--cursor-position-x": 0, "--cursor-position-y": 0, "--cursor-fill-color": "255, 0, 0", "--cursor-ripples": 1 });
	assert.ok(
		result.some(function atOrigin(c) {
			return c[0] === "arc" && c[1] === 0 && c[2] === 0;
		}),
	);
});
test("particles respect original count and size controls, animate, and vary by seed", function particleContract() {
	const values = { "--particles-count": 12, "--particles-size-min": 3, "--particles-size-max": 3, "--particles-lines-threshold": 0 };
	const output = render(particles, values);
	assert.equal(
		output.filter(function arc(c) {
			return c[0] === "arc";
		}).length,
		12,
	);
	assert.equal(
		output.filter(function stroke(c) {
			return c[0] === "stroke";
		}).length,
		0,
	);
	assert.ok(
		output
			.filter(function arc(c) {
				return c[0] === "arc";
			})
			.every(function radius(c) {
				return c[3] === 3;
			}),
	);
	assert.notDeepEqual(render(particles, { ...values, "--worklet-time": 0.4 }), output);
	assert.notDeepEqual(render(particles, { ...values, "--worklet-seed": 123 }), output);
});
test("particle counts and connection searches are bounded even in one dense cell", function particleBounds() {
	const output = render(particles, { "--particles-count": 1e9, "--particles-lines-threshold": 400 }, 10, 10);
	assert.equal(
		output.filter(function arc(c) {
			return c[0] === "arc";
		}).length,
		800,
	);
	assert.ok(
		output.filter(function stroke(c) {
			return c[0] === "stroke";
		}).length <=
			800 * 64,
	);
});
test("zero particle count and zero cursor rings paint no geometry", function zeroCounts() {
	assert.equal(
		render(particles, { "--particles-count": 0 }).filter(function arc(c) {
			return c[0] === "arc";
		}).length,
		0,
	);
	assert.equal(
		render(cursor, { "--cursor-ripples": 0 }).filter(function arc(c) {
			return c[0] === "arc";
		}).length,
		0,
	);
});
test("registration is safe to import and invoke during SSR", async function ssr() {
	assert.equal(await loadWorklet("https://example.com/worklet.js"), false);
});

test("the original cursor ripple mode expands and fades with CSS time", function animatedLegacyCursor() {
	const original = {
		"--cursor-mode": "rings",
		"--cursor-ripples": 5,
		"--cursor-size": 15,
		"--cursor-fill-color": "255, 0, 0",
		"--cursor-border-size": 0,
	};
	const first = render(cursor, { ...original, "--worklet-time": 0.15 });
	const later = render(cursor, { ...original, "--worklet-time": 0.7 });
	assert.notDeepEqual(first, later);
	const arcs = first.filter(function arc(command) {
		return command[0] === "arc";
	});
	const laterArcs = later.filter(function arc(command) {
		return command[0] === "arc";
	});
	assert.ok(Number(laterArcs[0][3]) > Number(arcs[0][3]));
	assert.equal(
		first.filter(function stroke(command) {
			return command[0] === "stroke";
		}).length,
		0,
	);
});

test("registration deduplicates concurrent loads and allows retries after rejection", async function registration() {
	const previous = Object.getOwnPropertyDescriptor(globalThis, "CSS");
	let calls = 0;
	Object.defineProperty(globalThis, "CSS", {
		configurable: true,
		value: {
			paintWorklet: {
				async addModule(url: string) {
					calls++;
					if (url.endsWith("bad.js")) throw new Error("network failure");
				},
			},
		},
	});
	try {
		await Promise.all([loadWorklet("https://test.invalid/good.js"), loadWorklet("https://test.invalid/good.js")]);
		assert.equal(calls, 1);
		await assert.rejects(loadWorklet("https://test.invalid/bad.js"), /network failure/);
		await assert.rejects(loadWorklet("https://test.invalid/bad.js"), /network failure/);
		assert.equal(calls, 3);
	} finally {
		if (previous) Object.defineProperty(globalThis, "CSS", previous);
		else Reflect.deleteProperty(globalThis, "CSS");
	}
});

test("all six cursor materials render and respond to CSS time", function cursorMaterials() {
	for (const mode of ["rings", "orbit", "ribbon", "comet", "plasma", "lens"]) {
		const inputs = { "--cursor-mode": mode, "--worklet-time": 0.2 };
		const first = render(cursor, inputs);
		assert.ok(first.length > 20, mode);
		assert.deepEqual(render(cursor, inputs), first);
		assert.notDeepEqual(render(cursor, { ...inputs, "--worklet-time": 0.7 }), first, mode);
		assert.notDeepEqual(render(cursor, { ...inputs, "--cursor-press": 1 }), first, mode);
	}
});

test("trail painters accept malformed and excessive history safely", function trailSafety() {
	for (const mode of ["ribbon", "comet"]) {
		assert.doesNotThrow(function malformed() {
			render(cursor, { "--cursor-mode": mode, "--cursor-trail": "NaN Infinity 2 broken -1e40 20" });
		});
		const repeated = Array.from({ length: 2000 }, function point() {
			return "100 100";
		}).join(" ");
		const output = render(cursor, { "--cursor-mode": mode, "--cursor-trail": repeated });
		assert.ok(output.length < 15000);
	}
});
