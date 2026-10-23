import { commonProperties, controls, drawable, number } from "../../core/src/index.ts";
import { spectrum, surface } from "../../core/src/surface.ts";
import type { PaintContext, PaintProperties, PaintSize } from "../../core/src/types.ts";
export const inputProperties = [...commonProperties, "--caustics-density", "--caustics-refraction", "--caustics-depth"];

/** Shade moving wave interference with focused light, dispersion, and water absorption. @param ctx Paint context. @param size CSS dimensions. @param properties CSS inputs. */
export function paint(ctx: PaintContext, size: PaintSize, properties: PaintProperties): void {
	if (!drawable(size)) return;
	const { phase, hue, intensity, seed, viewX, viewY } = controls(properties);
	const density = number(properties, "--caustics-density", 24, 8, 42) / 3;
	const refraction = number(properties, "--caustics-refraction", 1, 0.1, 2);
	const depth = number(properties, "--caustics-depth", 0.7, 0, 1);
	const scale = Math.min(size.width, size.height),
		t = phase + seed * 0.017;
	ctx.save();
	surface(
		ctx,
		size,
		function shade(u, v) {
			const x = ((u * size.width) / scale) * density + viewX * 0.4,
				y = ((v * size.height) / scale) * density + viewY * 0.4;
			let light = 0;
			for (let layer = 0; layer < 3; layer++) {
				const a = x + Math.sin(y * 1.25 + t + layer * 2.1) * refraction;
				const b = y + Math.cos(x * 1.3 - t + layer * 1.7) * refraction;
				const interference = Math.sin(a * 1.7 + layer) + Math.cos(b * 1.8 - layer);
				light += Math.exp(-Math.abs(interference) * 8) * (0.8 - layer * 0.18);
			}
			const shaft = Math.pow(Math.max(0, Math.sin((u + v * 0.36) * 9 + Math.sin(t) * 0.25)), 10) * (1 - v) * 0.1;
			const absorption = Math.exp(-v * (0.65 + depth));
			const illumination = (0.08 + light * light * 1.3 + shaft) * absorption * intensity;
			return spectrum(hue - light * 12 + v * 16, illumination, Math.max(0.1, 0.9 - light * 0.5));
		},
		176,
	);
	ctx.restore();
}
