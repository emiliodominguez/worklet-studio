import type { PaintContext, PaintProperties, PaintSize } from "./types.ts";
export type { PaintContext, PaintProperties, PaintSize, Painter } from "./types.ts";
export const TAU = Math.PI * 2;
export const commonProperties = [
	"--worklet-time",
	"--worklet-seed",
	"--worklet-hue",
	"--worklet-intensity",
	"--worklet-pointer-x",
	"--worklet-pointer-y",
];

/** Read a CSS token with a default. @param properties Input properties. @param name CSS variable. @param fallback Default value. @returns A trimmed token. */
export function token(properties: PaintProperties, name: string, fallback: string): string {
	return properties.get(name)?.toString().trim() || fallback;
}

/** Read and clamp a finite numeric input. @param properties Input properties. @param name CSS variable. @param fallback Default value. @param min Lower bound. @param max Upper bound. @returns A finite number. */
export function number(properties: PaintProperties, name: string, fallback: number, min = -1e6, max = 1e6): number {
	const raw = Number.parseFloat(token(properties, name, ""));
	return Math.max(min, Math.min(max, Number.isFinite(raw) ? raw : fallback));
}

/** Create a repeatable random sequence for stateless repaints. @param seed Integer seed. @returns A function producing values in [0, 1). */
export function random(seed: number): () => number {
	let state = seed | 0;
	return function next() {
		state += 0x6d2b79f5;
		let value = state;
		value = Math.imul(value ^ (value >>> 15), value | 1);
		value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
		return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
	};
}

/** Read common animation controls. @param properties Input properties. @returns Normalized animation, seed, hue, and intensity. */
export function controls(properties: PaintProperties) {
	return {
		phase: number(properties, "--worklet-time", 0) * TAU,
		seed: number(properties, "--worklet-seed", 42),
		hue: number(properties, "--worklet-hue", 225, -3600, 3600),
		intensity: number(properties, "--worklet-intensity", 1, 0, 2),
		viewX: number(properties, "--worklet-pointer-x", 0.5, 0, 1) - 0.5,
		viewY: number(properties, "--worklet-pointer-y", 0.5, 0, 1) - 0.5,
	};
}

/** Test whether a surface has drawable dimensions. @param size Surface size. @returns Whether both dimensions are positive and finite. */
export function drawable(size: PaintSize): boolean {
	return Number.isFinite(size.width) && Number.isFinite(size.height) && size.width > 0 && size.height > 0;
}

/** Draw a bounded radial glow using the Paint API's supported gradient operations. @param ctx Paint context. @param x Center x. @param y Center y. @param radius Glow radius. @param color Center color. */
export function glow(ctx: PaintContext, x: number, y: number, radius: number, color: string): void {
	if (radius <= 0) return;
	const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
	gradient.addColorStop(0, color);
	gradient.addColorStop(1, "transparent");
	ctx.fillStyle = gradient;
	ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

/** Accept the original cursor's RGB triplets alongside modern CSS colors. @param value CSS color or RGB triplet. @returns A CSS color. */
export function color(value: string): string {
	return /^\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*$/.test(value) ? `rgb(${value})` : value;
}
