import { commonProperties, controls, drawable, number } from "../../core/src/index.ts";
import { material, surface } from "../../core/src/surface.ts";
import type { PaintContext, PaintSize, PaintProperties } from "../../core/src/types.ts";
export const inputProperties = [
	...commonProperties,
	"--iridescence-scale",
	"--iridescence-ridges",
	"--iridescence-shimmer",
	"--iridescence-metallic",
	"--iridescence-position-x",
	"--iridescence-position-y",
];

/** Paint a folded thin film with analytic normals and spectral reflections. @param ctx Paint context. @param size CSS dimensions. @param properties CSS inputs. */
export function paint(ctx: PaintContext, size: PaintSize, properties: PaintProperties): void {
	if (!drawable(size)) return;
	const { phase, hue, intensity, seed, viewX, viewY } = controls(properties);
	const frequency = number(properties, "--iridescence-scale", 2.4, 0.3, 8);
	const ridges = number(properties, "--iridescence-ridges", 0.55, 0, 1);
	const shimmer = number(properties, "--iridescence-shimmer", 0.65, 0, 1);
	const metallic = number(properties, "--iridescence-metallic", 0.65, 0, 1);
	const px = number(properties, "--iridescence-position-x", 0.5, 0, 1) - 0.5 + viewX;
	const py = number(properties, "--iridescence-position-y", 0.5, 0, 1) - 0.5 + viewY;
	const t = phase + seed * 0.019;
	ctx.save();
	surface(
		ctx,
		size,
		function shade(u, v) {
			const x = (u - 0.5) * frequency * 3.2,
				y = (v - 0.5) * frequency * 2.5;
			const a = x + Math.sin(y * 0.8 + Math.sin(t)) * 1.7;
			const b = y + Math.cos(x * 0.65 - Math.cos(t)) * 1.6;
			const height = Math.sin(a) + Math.cos(b);
			const dx = Math.cos(a) + Math.sin(b) * Math.sin(x * 0.65 - Math.cos(t)) * 1.04;
			const dy = Math.cos(a) * Math.cos(y * 0.8 + Math.sin(t)) * 1.36 - Math.sin(b);
			const micro = Math.sin(height * 26 + y * 3) * ridges * 0.06;
			const length = Math.hypot(dx, dy, 0.9);
			return material(
				-dx / length,
				-dy / length,
				0.9 / length,
				hue + height * (35 + shimmer * 25) + micro * 100,
				intensity * (1 + micro),
				metallic,
				-0.45 + px,
				-0.65 + py,
			);
		},
		160,
	);
	ctx.restore();
}
