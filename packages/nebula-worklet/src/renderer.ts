import { commonProperties, controls, drawable, glow, number, random, TAU } from "../../core/src/index.ts";
import { fractal } from "../../core/src/noise.ts";
import { spectrum, surface } from "../../core/src/surface.ts";
import type { PaintContext, PaintProperties, PaintSize } from "../../core/src/types.ts";
export const inputProperties = [...commonProperties, "--nebula-clouds", "--nebula-spread", "--nebula-stars", "--nebula-dust"];

/** Paint drifting emission clouds, dust, and a stable star field. @param ctx Paint context. @param size CSS dimensions. @param properties CSS inputs. */
export function paint(ctx: PaintContext, size: PaintSize, properties: PaintProperties): void {
	if (!drawable(size)) return;
	const { phase, hue, intensity, seed, viewX, viewY } = controls(properties),
		next = random(seed);
	const clouds = Math.floor(number(properties, "--nebula-clouds", 160, 40, 240));
	const spread = number(properties, "--nebula-spread", 1, 0.3, 1.5);
	const stars = Math.floor(number(properties, "--nebula-stars", 140, 0, 260));
	const dust = number(properties, "--nebula-dust", 0.6, 0, 1);
	const scale = Math.min(size.width, size.height);
	ctx.save();
	const driftX = Math.cos(phase) * 0.2,
		driftY = Math.sin(phase) * 0.2;
	surface(
		ctx,
		size,
		function shade(u, v) {
			const x = (((u - 0.5) * size.width) / scale) * 3.5 + viewX * 0.12,
				y = ((v - 0.5) * 3.5) / spread + viewY * 0.12;
			const warp = fractal(x + driftX, y + driftY, seed);
			const detail = fractal(x * 2.2 + warp * 2 + driftY, y * 2.2 + driftX, seed + 71);
			const band = Math.exp(-Math.pow(y + Math.sin(x * 1.6 + driftX) * 0.6 + warp * 1.2, 2) * 2.5);
			const density = Math.max(0, 0.35 + detail * 1.1 + warp * 0.4) * band;
			const absorption = Math.exp(-Math.max(0, fractal(x * 2 - 3, y * 2 + driftX, seed + 153) + 0.18) * dust * 7);
			const light = (0.009 + density * absorption * (clouds / 100)) * intensity;
			return spectrum(hue + warp * 100 + detail * 55 + 20, light, 0.88 - density * 0.5);
		},
		160,
	);
	ctx.globalCompositeOperation = "lighter";
	for (let star = 0; star < stars; star++) {
		const x = next() * size.width + viewX * (star % 3) * 9,
			y = next() * size.height + viewY * (star % 3) * 9,
			radius = 0.35 + next() * 1.1;
		const light = (0.3 + next() * 0.5) * (0.8 + Math.sin(phase + star) * 0.2) * intensity;
		ctx.fillStyle = `hsla(${hue + next() * 65}, 45%, 88%, ${light})`;
		ctx.beginPath();
		ctx.arc(x, y, radius, 0, TAU);
		ctx.fill();
		if (star % 19 === 0) {
			glow(ctx, x, y, radius * 9, `hsla(${hue + 25}, 75%, 85%, ${light * 0.6})`);
			ctx.strokeStyle = `rgba(235, 245, 255, ${light * 0.4})`;
			ctx.lineWidth = 0.5;
			ctx.beginPath();
			ctx.moveTo(x - radius * 4, y);
			ctx.lineTo(x + radius * 4, y);
			ctx.moveTo(x, y - radius * 4);
			ctx.lineTo(x, y + radius * 4);
			ctx.stroke();
		}
	}
	ctx.restore();
}
