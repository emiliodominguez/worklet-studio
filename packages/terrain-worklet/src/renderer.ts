import { commonProperties, controls, drawable, glow, number } from "../../core/src/index.ts";
import { fractal } from "../../core/src/noise.ts";
import { spectrum } from "../../core/src/surface.ts";
import type { PaintContext, PaintProperties, PaintSize } from "../../core/src/types.ts";
export const inputProperties = [...commonProperties, "--terrain-lines", "--terrain-height", "--terrain-complexity", "--terrain-perspective"];

/** Paint occluding mountain ridges with atmospheric depth and illuminated contour edges. @param ctx Paint context. @param size CSS dimensions. @param properties CSS inputs. */
export function paint(ctx: PaintContext, size: PaintSize, properties: PaintProperties): void {
	if (!drawable(size)) return;
	const { phase, hue, intensity, seed, viewX, viewY } = controls(properties);
	const lines = Math.floor(number(properties, "--terrain-lines", 90, 20, 150));
	const elevation = number(properties, "--terrain-height", 0.85, 0, 1.5);
	const complexity = number(properties, "--terrain-complexity", 2.2, 0.5, 5);
	const perspective = number(properties, "--terrain-perspective", 0.65, 0, 1);
	const t = phase + seed * 0.011;
	ctx.save();
	glow(ctx, size.width * (0.45 + viewX * 0.05), size.height * 0.3, size.width * 0.6, `hsla(${hue + 25}, 80%, 50%, ${intensity * 0.2})`);
	for (let line = 0; line < lines; line++) {
		const v = line / (lines - 1),
			depth = Math.pow(v, 1 + perspective * 0.8);
		const points: { x: number; y: number; height: number }[] = [];
		const gradient = ctx.createLinearGradient(0, 0, size.width, 0);
		for (let step = 0; step <= 128; step++) {
			const u = step / 128;
			const mountain = fractal(u * complexity * 3 + Math.sin(t) * 0.25, v * complexity * 2 + Math.cos(t) * 0.2, seed);
			const envelope = Math.pow(Math.sin(u * Math.PI), 0.7);
			const height = (mountain + 0.32) * envelope * elevation;
			const x = size.width * (u + viewX * (depth - 0.5) * 0.035);
			const y = size.height * (0.35 + depth * 0.65 - height * (0.25 + depth * 0.2) + viewY * depth * 0.03);
			points.push({ x, y, height });
			const slope = step ? (height - points[step - 1].height) * 20 : 0;
			const light = (0.035 + (1 - depth) * 0.075 + Math.max(0, -slope) * 0.16) * intensity;
			gradient.addColorStop(u, spectrum(hue + depth * 35, light, 0.6));
		}
		ctx.fillStyle = gradient;
		ctx.beginPath();
		ctx.moveTo(-size.width * 0.1, size.height * 1.1);
		for (const point of points) ctx.lineTo(point.x, point.y);
		ctx.lineTo(size.width * 1.1, size.height * 1.1);
		ctx.closePath();
		ctx.fill();
		ctx.strokeStyle = `hsla(${hue + 25 + depth * 45}, 85%, ${65 + depth * 15}%, ${(line % 5 === 0 ? 0.7 : 0.25) * (0.25 + depth * 0.75) * intensity})`;
		ctx.lineWidth = line % 5 === 0 ? 1 : 0.55;
		ctx.beginPath();
		for (let i = 0; i < points.length; i++) {
			if (i) ctx.lineTo(points[i].x, points[i].y);
			else ctx.moveTo(points[i].x, points[i].y);
		}
		ctx.stroke();
	}
	ctx.restore();
}
