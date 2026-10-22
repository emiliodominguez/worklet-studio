import { commonProperties, controls, drawable, number } from "../../core/src/index.ts";
import type { PaintContext, PaintProperties, PaintSize } from "../../core/src/types.ts";
export const inputProperties = [...commonProperties, "--terrain-lines", "--terrain-height", "--terrain-complexity", "--terrain-perspective"];

/** Trace a continuous height field as luminous terrain contours. @param ctx Paint context. @param size CSS dimensions. @param properties CSS inputs. */
export function paint(ctx: PaintContext, size: PaintSize, properties: PaintProperties): void {
	if (!drawable(size)) return;
	const { phase, hue, intensity, seed } = controls(properties);
	const lines = Math.floor(number(properties, "--terrain-lines", 90, 20, 150));
	const elevation = number(properties, "--terrain-height", 0.85, 0, 1.5);
	const complexity = number(properties, "--terrain-complexity", 2.2, 0.5, 5);
	const perspective = number(properties, "--terrain-perspective", 0.65, 0, 1);
	const t = phase + seed * 0.011;
	ctx.save();
	ctx.globalCompositeOperation = "lighter";
	for (let line = 0; line < lines; line++) {
		const v = line / (lines - 1);
		const gradient = ctx.createLinearGradient(0, 0, size.width, 0);
		gradient.addColorStop(0, `hsla(${hue - 30}, 90%, 65%, 0.02)`);
		gradient.addColorStop(0.25, `hsla(${hue + v * 60}, 90%, 72%, ${intensity * (0.25 + v * 0.5)})`);
		gradient.addColorStop(0.7, `hsla(${hue + 70 + v * 30}, 95%, 75%, ${intensity * (0.3 + v * 0.5)})`);
		gradient.addColorStop(1, `hsla(${hue + 100}, 90%, 65%, 0.02)`);
		ctx.strokeStyle = gradient;
		ctx.lineWidth = line % 6 === 0 ? 1.3 : 0.65;
		ctx.beginPath();
		for (let step = 0; step <= 144; step++) {
			const u = step / 144;
			const envelope = Math.pow(Math.sin(u * Math.PI), 1.5) * Math.sin(v * Math.PI);
			const height = Math.sin(u * complexity * 5 + Math.sin(t) + v * 4) * 0.6 + Math.cos(u * complexity * 3 - v * 7 + Math.cos(t)) * 0.4;
			const width = 1 - perspective * (1 - v) * 0.25;
			const x = size.width * (0.5 + (u - 0.5) * width);
			const y = size.height * (0.13 + v * 0.72 - height * envelope * 0.25 * elevation);
			if (!step) ctx.moveTo(x, y);
			else ctx.lineTo(x, y);
		}
		ctx.stroke();
	}
	ctx.restore();
}
