import { blur, commonProperties, controls, drawable, glow, number, random, TAU } from "../../core/src/index.ts";
import { spectrum } from "../../core/src/surface.ts";
import type { PaintContext, PaintProperties, PaintSize } from "../../core/src/types.ts";

export const inputProperties = [
	...commonProperties,
	"--vortex-rings",
	"--vortex-tilt",
	"--vortex-lensing",
	"--vortex-radius",
	"--vortex-inclination",
];

/** Azimuthal samples per gas band; conic gradients interpolate between them. */
const STOPS = 48;

interface Band {
	gradient: CanvasGradient;
	inner: number;
	outer: number;
}

interface Disk {
	radius: number;
	inner: number;
	shadow: number;
	hue: number;
	intensity: number;
	phase: number;
	inclination: number;
}

/** Relativistic beaming approximation: the approaching (left) side brightens, the receding side dims. @param angle Disk azimuth. @returns Brightness multiplier. */
function beaming(angle: number): number {
	return Math.pow(1 - 0.4 * Math.cos(angle), 2.6);
}

/** Build one band's emission around the full orbit: radial cooling, Doppler beaming and sheared turbulent clumps. Integer frequencies and speeds keep the loop seamless. @param ctx Paint context. @param disk Shared disk state. @param fraction Radial position from the inner edge. @param next Seeded random source. @returns Conic emission gradient centered on the hole. */
function emission(ctx: PaintContext, disk: Disk, fraction: number, next: () => number): CanvasGradient {
	const gradient = ctx.createConicGradient(0, 0, 0);
	const heat = Math.exp(-fraction * 2.6) * (1 - Math.exp(-(fraction + 0.015) * 40)) * (1 - Math.pow(fraction, 2.5));
	const lane = 0.42 + next() * 0.4 + 0.3 * Math.pow(Math.max(0, Math.sin(fraction * 41 + next() * 3)), 6);
	const speed = 1 + Math.round(Math.pow(1 - fraction, 1.5) * 5);
	const low = 2 + Math.floor(next() * 4),
		high = 7 + Math.floor(next() * 9);
	const lowPhase = next() * TAU,
		highPhase = next() * TAU;
	const rotation = disk.phase * speed;
	for (let stop = 0; stop <= STOPS; stop++) {
		const angle = (stop / STOPS) * TAU;
		const orbit = angle + rotation;
		const clumps = Math.max(0.08, 1 + 0.42 * Math.sin(low * orbit + lowPhase) + 0.28 * Math.sin(high * orbit + highPhase));
		const doppler = beaming(angle);
		const light = 2.2 * heat * lane * clumps * doppler * disk.intensity;
		const shift = Math.max(-1, Math.min(1, (doppler - 1) * 0.6));
		gradient.addColorStop(stop / STOPS, spectrum(disk.hue + shift * 22 - (1 - heat) * 14, light, 0.82 - Math.max(0, shift) * 0.35));
	}
	return gradient;
}

/** Fill one half (or all) of an annulus in the current transform. @param ctx Paint context. @param inner Inner radius. @param outer Outer radius. @param start Start angle. @param end End angle. */
function annulus(ctx: PaintContext, inner: number, outer: number, start: number, end: number): void {
	ctx.beginPath();
	ctx.arc(0, 0, outer, start, end);
	ctx.arc(0, 0, inner, end, start, true);
	ctx.closePath();
	ctx.fill();
}

/** Paint the direct image of one disk half: thin abutting bands composited additively so their seams vanish. @param ctx Paint context. @param disk Shared disk state. @param bands Emission bands. @param front Paint the near half. */
function accretion(ctx: PaintContext, disk: Disk, bands: Band[], front: boolean): void {
	ctx.save();
	ctx.scale(1, disk.inclination);
	for (const band of bands) {
		ctx.fillStyle = band.gradient;
		annulus(ctx, band.inner, band.outer, front ? 0 : Math.PI, front ? Math.PI : TAU);
	}
	ctx.restore();
}

/** Paint the gravitationally lensed images of the far disk: a thick arch over the shadow and a thin one beneath it. @param ctx Paint context. @param disk Shared disk state. @param bands Emission bands. @param lensing Light-bending strength. @param underside Paint the compressed lower image. */
function lensedImage(ctx: PaintContext, disk: Disk, bands: Band[], lensing: number, underside: boolean): void {
	if (lensing <= 0) return;
	const spread = disk.shadow * (underside ? 0.16 : 0.62) * Math.min(1.5, lensing);
	const start = disk.shadow * (underside ? 1.035 : 1.06);
	const span = disk.radius - disk.inner;
	ctx.save();
	const opacity = Math.min(1, lensing);
	ctx.scale(1, underside ? 0.9 : 1.02);
	for (const band of bands) {
		const inner = start + Math.pow((band.inner - disk.inner) / span, 0.8) * spread,
			outer = start + Math.pow((band.outer - disk.inner) / span, 0.8) * spread;
		if (outer - inner < 0.05) continue;
		ctx.globalAlpha = opacity * Math.pow(1 - (band.inner - disk.inner) / span, 0.6);
		ctx.fillStyle = band.gradient;
		annulus(ctx, inner, outer, underside ? 0 : Math.PI, underside ? Math.PI : TAU);
	}
	ctx.restore();
}

/** Soft bloom: one blurred, coarse copy of the hot inner disk per half (and of the lensed arches), since every filtered draw costs a layer. @param ctx Paint context. @param disk Shared disk state. @param bands Emission bands. @param lensing Light-bending strength. @param front Bloom the near half. */
function bloom(ctx: PaintContext, disk: Disk, bands: Band[], lensing: number, front: boolean): void {
	ctx.save();
	blur(ctx, disk.radius * 0.03);
	ctx.globalAlpha = 0.5;
	ctx.fillStyle = bands[Math.floor(bands.length * 0.12)].gradient;
	ctx.save();
	ctx.scale(1, disk.inclination);
	annulus(ctx, disk.inner, disk.inner + (disk.radius - disk.inner) * 0.5, front ? 0 : Math.PI, front ? Math.PI : TAU);
	ctx.restore();
	if (!front && lensing > 0) {
		ctx.globalAlpha = 0.45 * Math.min(1, lensing);
		ctx.beginPath();
		ctx.arc(0, 0, disk.shadow * (1.08 + 0.3 * Math.min(1.5, lensing)), Math.PI, TAU);
		ctx.arc(0, 0, disk.shadow * 1.04, TAU, Math.PI, true);
		ctx.closePath();
		ctx.moveTo(disk.shadow * 1.16, 0);
		ctx.arc(0, 0, disk.shadow * 1.16, 0, Math.PI);
		ctx.arc(0, 0, disk.shadow * 1.03, Math.PI, 0, true);
		ctx.closePath();
		ctx.fill();
	}
	ctx.restore();
}

/** Scatter a background star field displaced and stretched by the lens: each star's primary image is pushed outward and smeared tangentially. @param ctx Paint context. @param size CSS dimensions. @param cx Hole x. @param cy Hole y. @param shadow Shadow radius. @param seed Variation seed. @param intensity Exposure. @param viewX Pointer parallax. @param viewY Pointer parallax. */
function stars(
	ctx: PaintContext,
	size: PaintSize,
	cx: number,
	cy: number,
	shadow: number,
	seed: number,
	intensity: number,
	viewX: number,
	viewY: number,
): void {
	const next = random(seed + 911),
		einstein = shadow * 1.2;
	ctx.save();
	ctx.globalCompositeOperation = "lighter";
	for (let star = 0; star < 260; star++) {
		const depth = next(),
			warmth = next(),
			bright = Math.pow(next(), 3);
		const dx = next() * size.width - cx + viewX * depth * 24,
			dy = next() * size.height - cy + viewY * depth * 24;
		const distance = Math.hypot(dx, dy) || 1;
		const lensed = (distance + Math.sqrt(distance * distance + 4 * einstein * einstein)) / 2;
		const stretch = Math.min(5, lensed / distance);
		const x = cx + (dx / distance) * lensed,
			y = cy + (dy / distance) * lensed;
		const radius = 0.3 + depth * 0.45 + bright * 0.9;
		const alpha = Math.min(1, ((0.12 + depth * 0.4 + bright * 0.6) * intensity) / Math.sqrt(stretch));
		ctx.fillStyle = `hsla(${warmth > 0.7 ? 35 : 215}, ${30 + warmth * 30}%, 88%, ${alpha})`;
		ctx.beginPath();
		ctx.ellipse(x, y, radius, radius * stretch, Math.atan2(dy, dx), 0, TAU);
		ctx.fill();
		if (bright > 0.55) glow(ctx, x, y, radius * 7, `hsla(${warmth > 0.7 ? 35 : 215}, 70%, 80%, ${alpha * 0.35})`);
	}
	ctx.restore();
}

/** Paint an illustrative black hole: lensed star field, a Doppler-beamed turbulent disk, its lensed far-side images, a photon ring and bloom. @param ctx Paint context. @param size CSS dimensions. @param properties CSS inputs. */
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
		inner: shadow * 1.16,
		shadow,
		hue,
		intensity,
		phase,
		inclination: number(properties, "--vortex-inclination", 0.12, 0.04, 0.5) + viewY * 0.035,
	};
	const cx = size.width * 0.5 + viewX * radius * 0.07,
		cy = size.height * 0.5 + viewY * radius * 0.07;
	ctx.save();
	const sky = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.hypot(size.width, size.height) * 0.6);
	sky.addColorStop(0, spectrum(hue, 0.035 * intensity, 0.6));
	sky.addColorStop(0.45, spectrum(hue + 20, 0.012 * intensity, 0.5));
	sky.addColorStop(1, "rgb(2, 3, 6)");
	ctx.fillStyle = sky;
	ctx.fillRect(0, 0, size.width, size.height);
	stars(ctx, size, cx, cy, shadow, seed, intensity, viewX, viewY);
	ctx.translate(cx, cy);
	ctx.rotate(tilt);
	const next = random(seed);
	const bands: Band[] = [];
	const width = (radius - disk.inner) / rings;
	for (let ring = 0; ring < rings; ring++) {
		const inner = disk.inner + Math.pow(ring / rings, 1.25) * (radius - disk.inner),
			outer = disk.inner + Math.pow((ring + 1) / rings, 1.25) * (radius - disk.inner);
		bands.push({ inner, outer: Math.max(outer, inner + width * 0.2), gradient: emission(ctx, disk, ring / rings, next) });
	}
	ctx.globalCompositeOperation = "lighter";
	glow(ctx, 0, 0, radius * 1.1, spectrum(hue, 0.08 * intensity, 0.7, 0.4));
	accretion(ctx, disk, bands, false);
	bloom(ctx, disk, bands, lensing, false);
	lensedImage(ctx, disk, bands, lensing, false);
	lensedImage(ctx, disk, bands, lensing, true);
	// The shadow occludes everything behind it; the near half of the disk then crosses in front.
	ctx.globalCompositeOperation = "source-over";
	const hole = ctx.createRadialGradient(0, 0, shadow * 0.9, 0, 0, shadow * 1.02);
	hole.addColorStop(0, "#000");
	hole.addColorStop(1, "rgba(0, 0, 0, 0.9)");
	ctx.fillStyle = hole;
	ctx.beginPath();
	ctx.arc(0, 0, shadow * 1.02, 0, TAU);
	ctx.fill();
	ctx.globalCompositeOperation = "lighter";
	if (lensing > 0) {
		// Photon ring: light that orbited the hole, a razor line with its own halo.
		const ring = ctx.createConicGradient(0, 0, 0);
		for (let stop = 0; stop <= 16; stop++) {
			const angle = (stop / 16) * TAU;
			ring.addColorStop(stop / 16, spectrum(hue + 15, 1.6 * beaming(angle) * intensity * Math.min(1, lensing), 0.4));
		}
		ctx.strokeStyle = ring;
		ctx.save();
		blur(ctx, shadow * 0.04);
		ctx.globalAlpha = 0.8;
		ctx.lineWidth = shadow * 0.05;
		ctx.beginPath();
		ctx.arc(0, 0, shadow * 1.03, 0, TAU);
		ctx.stroke();
		ctx.restore();
		ctx.lineWidth = Math.max(0.6, shadow * 0.008);
		ctx.beginPath();
		ctx.arc(0, 0, shadow * 1.025, 0, TAU);
		ctx.stroke();
	}
	accretion(ctx, disk, bands, true);
	bloom(ctx, disk, bands, lensing, true);
	// Anamorphic glare across the hottest, approaching edge of the disk.
	const glareX = -disk.inner * 1.15;
	const glare = ctx.createRadialGradient(0, 0, 0, 0, 0, radius * 0.9);
	glare.addColorStop(0, spectrum(hue + 20, 1.1 * intensity, 0.35, 0.55));
	glare.addColorStop(0.25, spectrum(hue + 10, 0.35 * intensity, 0.6, 0.18));
	glare.addColorStop(1, "transparent");
	ctx.save();
	ctx.translate(glareX, 0);
	ctx.scale(1, 0.018);
	ctx.fillStyle = glare;
	ctx.beginPath();
	ctx.arc(0, 0, radius * 0.9, 0, TAU);
	ctx.fill();
	ctx.restore();
	glow(ctx, glareX, 0, shadow * 0.55, spectrum(hue + 20, 0.9 * intensity, 0.4, 0.35));
	ctx.restore();
}
