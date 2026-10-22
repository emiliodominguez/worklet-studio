import { commonProperties, controls, drawable, number, random, TAU } from "../../core/src/index.ts";
import type { PaintContext, PaintSize, PaintProperties } from "../../core/src/types.ts";
export const inputProperties = [...commonProperties, "--flow-density", "--flow-turbulence", "--flow-length", "--flow-vortex"];

/** Trace bounded, seeded streamlines through an animated vector field. @param ctx Paint context. @param size CSS-pixel dimensions. @param properties CSS inputs. */
export function paint(ctx: PaintContext, size: PaintSize, properties: PaintProperties): void {
	if (!drawable(size)) return;
	const { phase, hue, intensity, seed } = controls(properties),
		next = random(seed);
	const count = Math.floor(number(properties, "--flow-density", 550, 10, 1000));
	const turbulence = number(properties, "--flow-turbulence", 2.4, 0.1, 8);
	const length = Math.floor(number(properties, "--flow-length", 44, 4, 80));
	const vortex = number(properties, "--flow-vortex", 1, 0, 3);
	const scale = Math.min(size.width, size.height);
	ctx.save();
	ctx.globalCompositeOperation = "lighter";
	ctx.lineCap = "round";
	for (let line = 0; line < count; line++) {
		let x = next() * size.width,
			y = next() * size.height;
		const tint = hue + (x / size.width) * 95 + next() * 30;
		const alpha = (0.12 + next() * 0.42) * intensity;
		ctx.strokeStyle = `hsla(${tint}, 85%, ${55 + next() * 25}%, ${alpha})`;
		ctx.lineWidth = 0.45 + next() * 1.1;
		ctx.beginPath();
		ctx.moveTo(x, y);
		for (let step = 0; step < length; step++) {
			const nx = (x - size.width / 2) / scale,
				ny = (y - size.height / 2) / scale;
			const angle = Math.sin(nx * turbulence * 3 + Math.sin(phase) * 0.7) + Math.cos(ny * turbulence * 3 - Math.cos(phase) * 0.7);
			const orbit = Math.atan2(ny, nx) + Math.PI / 2;
			const blend = Math.min(0.94, vortex / (1 + Math.hypot(nx, ny) * 3));
			x += (Math.cos(angle * TAU * 0.3) * (1 - blend) + Math.cos(orbit) * blend) * scale * 0.007;
			y += (Math.sin(angle * TAU * 0.3) * (1 - blend) + Math.sin(orbit) * blend) * scale * 0.007;
			ctx.lineTo(x, y);
		}
		ctx.stroke();
	}
	ctx.restore();
}
