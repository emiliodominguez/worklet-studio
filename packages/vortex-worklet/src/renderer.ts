import { commonProperties, controls, drawable, glow, number, random, TAU } from "../../core/src/index.ts";
import type { PaintContext, PaintProperties, PaintSize } from "../../core/src/types.ts";
export const inputProperties = [...commonProperties, "--vortex-rings", "--vortex-tilt", "--vortex-lensing", "--vortex-radius"];

/** Paint a tilted accretion disk and bent light around a dark core. @param ctx Paint context. @param size CSS dimensions. @param properties CSS inputs. */
export function paint(ctx: PaintContext, size: PaintSize, properties: PaintProperties): void {
	if (!drawable(size)) return;
	const { phase, hue, intensity, seed } = controls(properties),
		next = random(seed);
	const rings = Math.floor(number(properties, "--vortex-rings", 100, 20, 160));
	const tilt = (number(properties, "--vortex-tilt", -12, -60, 60) * Math.PI) / 180;
	const lensing = number(properties, "--vortex-lensing", 0.9, 0, 1.5);
	const radius = Math.min(size.width * 0.44, size.height * 0.56) * number(properties, "--vortex-radius", 1, 0.3, 1.3);
	ctx.save();
	ctx.translate(size.width / 2, size.height / 2);
	ctx.rotate(tilt);
	ctx.globalCompositeOperation = "lighter";
	glow(ctx, 0, 0, radius, `hsla(${hue}, 90%, 60%, ${0.13 * intensity})`);
	for (let ring = rings - 1; ring >= 0; ring--) {
		const f = ring / rings,
			r = radius * (0.18 + f * 0.82),
			offset = next() * TAU;
		const gradient = ctx.createLinearGradient(-r, 0, r, 0);
		gradient.addColorStop(0, `hsla(${hue - f * 25}, 95%, 60%, ${0.15 * intensity})`);
		gradient.addColorStop(0.45, `hsla(${hue + 15 + f * 30}, 95%, 78%, ${0.8 * intensity})`);
		gradient.addColorStop(0.7, `hsla(${hue + f * 50}, 95%, 70%, ${0.65 * intensity})`);
		gradient.addColorStop(1, `hsla(${hue + 35}, 90%, 55%, ${0.05 * intensity})`);
		ctx.strokeStyle = gradient;
		ctx.lineWidth = ring % 8 === 0 ? 1.4 : 0.65;
		ctx.beginPath();
		for (let step = 0; step <= 144; step++) {
			const a = (step / 144) * TAU;
			const perturbation = 1 + Math.sin(a * 5 + phase + offset) * 0.008 + Math.sin(a * 11 - phase) * 0.003;
			const x = Math.cos(a) * r * perturbation;
			let y = Math.sin(a) * r * 0.26;
			if (Math.sin(a) < 0) y -= Math.exp(-Math.pow(x / (radius * 0.28), 2)) * radius * 0.6 * (1 - f * 0.45) * lensing;
			if (!step) ctx.moveTo(x, y);
			else ctx.lineTo(x, y);
		}
		ctx.closePath();
		ctx.stroke();
	}
	ctx.globalCompositeOperation = "source-over";
	const hole = ctx.createRadialGradient(0, 0, radius * 0.11, 0, 0, radius * 0.2);
	hole.addColorStop(0, "#030409");
	hole.addColorStop(0.75, "rgba(3,4,9,0.96)");
	hole.addColorStop(1, "transparent");
	ctx.fillStyle = hole;
	ctx.beginPath();
	ctx.arc(0, 0, radius * 0.2, 0, TAU);
	ctx.fill();
	ctx.globalCompositeOperation = "lighter";
	for (let halo = 0; halo < 3; halo++) {
		ctx.lineWidth = 0.8 + halo * 1.1;
		ctx.strokeStyle = `hsla(${hue + halo * 15}, 90%, 85%, ${intensity * (0.65 - halo * 0.2)})`;
		ctx.beginPath();
		ctx.arc(0, 0, radius * (0.16 + halo * 0.008), 0, TAU);
		ctx.stroke();
	}
	ctx.restore();
}
