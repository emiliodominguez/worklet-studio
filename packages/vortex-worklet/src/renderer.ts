import { commonProperties, controls, drawable, glow, number, random, TAU } from "../../core/src/index.ts";
import type { PaintContext, PaintProperties, PaintSize } from "../../core/src/types.ts";

export const inputProperties = [
	...commonProperties,
	"--vortex-rings",
	"--vortex-tilt",
	"--vortex-lensing",
	"--vortex-radius",
	"--vortex-inclination",
];

interface Disk {
	radius: number;
	shadow: number;
	hue: number;
	intensity: number;
	phase: number;
	seed: number;
	rings: number;
	inclination: number;
}

/** Shade hot gas with radial cooling, turbulent lanes, and a brighter approaching side. @param ctx Paint context. @param disk Shared disk state. @param radius Band radius. @param fraction Radial position. @param opacity Image brightness. @returns Emission gradient. */
function emission(ctx: PaintContext, disk: Disk, radius: number, fraction: number, opacity: number): CanvasGradient {
	const gradient = ctx.createLinearGradient(-radius, 0, radius, 0);
	const lane = 0.78 + 0.14 * Math.sin(fraction * 83 + disk.seed) + 0.08 * Math.sin(fraction * 191 - disk.seed);
	for (let stop = 0; stop <= 24; stop++) {
		const u = stop / 24;
		const angle = Math.acos(u * 2 - 1);
		const motion = disk.phase * (1 + Math.floor((1 - fraction) * 3));
		const turbulence = 0.8 + 0.12 * Math.sin(angle * 7 + fraction * 43 - motion) + 0.08 * Math.sin(angle * 17 - fraction * 91 + motion);
		const beaming = 0.42 + 0.58 * Math.pow(1 - u, 0.65);
		const heat = Math.exp(-fraction * 2.2) * lane * turbulence * beaming;
		const light = Math.min(94, 8 + Math.pow(heat, 0.65) * 105 * disk.intensity);
		gradient.addColorStop(u, `hsla(${disk.hue - 12 + heat * 35}, ${95 - heat * 70}%, ${light}%, ${opacity})`);
	}
	return gradient;
}

/** Trace one half of the thin accretion disk, with small orbiting distortions. @param ctx Paint context. @param disk Shared disk state. @param front Draw the foreground half. */
function accretion(ctx: PaintContext, disk: Disk, front: boolean): void {
	const inner = disk.shadow * 1.22;
	const spacing = (disk.radius - inner) / disk.rings;
	for (let ring = disk.rings - 1; ring >= 0; ring--) {
		const fraction = ring / (disk.rings - 1),
			radius = inner + fraction * (disk.radius - inner);
		const fade = Math.pow(1 - fraction, 0.65);
		ctx.fillStyle = emission(ctx, disk, radius, fraction, fade * 0.95);
		ctx.beginPath();
		for (let edge = 0; edge < 2; edge++) {
			const r = radius + edge * spacing * 1.3;
			const radial = (r - inner) / (disk.radius - inner);
			for (let step = 0; step <= 96; step++) {
				const angle = (front ? 0 : Math.PI) + ((edge ? 96 - step : step) / 96) * Math.PI;
				const perturbation = Math.sin(angle * 5 + radial * 12 - disk.phase * 2 + disk.seed * 0.013) * 0.003;
				const x = Math.cos(angle) * r * (1 + perturbation);
				const y = Math.sin(angle) * r * disk.inclination + perturbation * disk.radius * 0.16;
				if (!edge && !step) ctx.moveTo(x, y);
				else ctx.lineTo(x, y);
			}
		}
		ctx.closePath();
		ctx.fill();
	}
}

/** Approximate the far-side and underside images as concentric arcs around the shadow. @param ctx Paint context. @param disk Shared disk state. @param lensing Light-bending strength. @param underside Draw the compressed lower image. */
function lensedImage(ctx: PaintContext, disk: Disk, lensing: number, underside: boolean): void {
	if (!lensing) return;
	const bands = Math.max(20, Math.floor(disk.rings * 0.75));
	const spread = disk.shadow * (underside ? 0.28 : 0.95) * Math.min(1.4, lensing);
	for (let band = bands - 1; band >= 0; band--) {
		const fraction = band / (bands - 1),
			radius = disk.shadow * 1.12 + fraction * spread;
		const fade = Math.pow(1 - fraction, 1.3) * Math.min(1, lensing);
		ctx.strokeStyle = emission(ctx, disk, radius, fraction, fade * (underside ? 0.65 : 0.95));
		ctx.lineWidth = Math.max(0.45, (spread / bands) * 1.25);
		ctx.beginPath();
		for (let step = 0; step <= 120; step++) {
			const angle = (underside ? 0 : Math.PI) + (step / 120) * Math.PI;
			const texture = 1 + Math.sin(angle * 15 + fraction * 70 - disk.phase * 2) * 0.002;
			const x = Math.cos(angle) * radius * texture;
			const y = Math.sin(angle) * radius * (underside ? 0.92 : 1) * texture;
			if (!step) ctx.moveTo(x, y);
			else ctx.lineTo(x, y);
		}
		ctx.stroke();
	}
}

/** Paint an illustrative black-hole accretion disk with correct depth ordering and bounded vector geometry. @param ctx Paint context. @param size CSS dimensions. @param properties CSS inputs. */
export function paint(ctx: PaintContext, size: PaintSize, properties: PaintProperties): void {
	if (!drawable(size)) return;
	const { phase, hue, intensity, seed, viewX, viewY } = controls(properties);
	const rings = Math.floor(number(properties, "--vortex-rings", 100, 20, 160));
	const tilt = (number(properties, "--vortex-tilt", -8, -60, 60) * Math.PI) / 180;
	const lensing = number(properties, "--vortex-lensing", 0.9, 0, 1.5);
	const radius = Math.min(size.width * 0.44, size.height * 0.68) * number(properties, "--vortex-radius", 1, 0.3, 1.3);
	const shadow = radius * 0.26;
	const disk: Disk = {
		radius,
		shadow,
		hue,
		intensity,
		phase,
		seed,
		rings,
		inclination: number(properties, "--vortex-inclination", 0.12, 0.04, 0.5) + viewY * 0.035,
	};
	ctx.save();
	const next = random(seed);
	for (let star = 0; star < 100; star++) {
		const x = next() * size.width,
			y = next() * size.height;
		const distance = Math.hypot(x - size.width / 2, y - size.height / 2);
		if (distance < shadow * 2.5) continue;
		const depth = next();
		ctx.fillStyle = `rgba(195, 215, 245, ${(0.1 + depth * 0.3) * intensity})`;
		ctx.fillRect(x + viewX * depth * 16, y + viewY * depth * 16, 0.5 + depth, 0.5 + depth);
	}
	ctx.translate(size.width * 0.5 + viewX * radius * 0.07, size.height * 0.5 + viewY * radius * 0.07);
	ctx.rotate(tilt);
	glow(ctx, -shadow * 0.5, 0, radius * 0.75, `hsla(${hue}, 90%, 45%, ${0.14 * intensity})`);
	accretion(ctx, disk, false);
	lensedImage(ctx, disk, lensing, false);
	lensedImage(ctx, disk, lensing, true);
	// The circular shadow occludes the far-side images; the near disk crosses in front.
	ctx.fillStyle = "#020203";
	ctx.beginPath();
	ctx.arc(0, 0, shadow, 0, TAU);
	ctx.fill();
	if (lensing > 0) {
		ctx.strokeStyle = emission(ctx, disk, shadow, 0.08, Math.min(1, lensing));
		ctx.lineWidth = Math.max(0.65, radius * 0.002);
		ctx.beginPath();
		ctx.arc(0, 0, shadow * 1.012, 0, TAU);
		ctx.stroke();
	}
	accretion(ctx, disk, true);
	ctx.globalCompositeOperation = "lighter";
	glow(ctx, -shadow * 1.4, shadow * disk.inclination, radius * 0.22, `hsla(${hue + 20}, 75%, 65%, ${0.18 * intensity})`);
	ctx.restore();
}
