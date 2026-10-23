import { commonProperties, controls, drawable, number, TAU } from "../../core/src/index.ts";
import { material, surface } from "../../core/src/surface.ts";
import type { PaintContext, PaintSize, PaintProperties } from "../../core/src/types.ts";
export const inputProperties = [
	...commonProperties,
	"--ripple-rings",
	"--ripple-distortion",
	"--ripple-sources",
	"--ripple-position-x",
	"--ripple-position-y",
];

/** Shade interfering wave normals with moving studio reflections. @param ctx Paint context. @param size CSS dimensions. @param properties CSS inputs. */
export function paint(ctx: PaintContext, size: PaintSize, properties: PaintProperties): void {
	if (!drawable(size)) return;
	const { phase, hue, intensity, seed, viewX, viewY } = controls(properties);
	const rings = Math.floor(number(properties, "--ripple-rings", 50, 4, 90));
	const distortion = number(properties, "--ripple-distortion", 0.45, 0, 1.5);
	const sources = Math.floor(number(properties, "--ripple-sources", 2, 1, 4));
	const scale = Math.min(size.width, size.height);
	const px = number(properties, "--ripple-position-x", size.width / 2, -size.width, size.width * 2) / scale;
	const py = number(properties, "--ripple-position-y", size.height / 2, -size.height, size.height * 2) / scale;
	const centers: { x: number; y: number }[] = [];
	for (let source = 0; source < sources; source++) {
		const angle = (source / sources) * TAU + seed * 0.01;
		centers.push({ x: px + Math.cos(angle + Math.sin(phase) * 0.25) * (sources > 1 ? 0.2 : 0), y: py + Math.sin(angle) * 0.15 });
	}
	ctx.save();
	surface(
		ctx,
		size,
		function shade(u, v) {
			let dx = 0,
				dy = 0,
				height = 0;
			const x = (u * size.width) / scale,
				y = (v * size.height) / scale;
			for (const center of centers) {
				const ox = x - center.x,
					oy = y - center.y,
					distance = Math.hypot(ox, oy) + 0.001;
				const wave = distance * rings * 0.65 - phase * 4 + Math.sin(ox * 8 + phase) * distortion;
				const fade = Math.exp(-distance * 1.5);
				const slope = Math.cos(wave) * fade * 0.7;
				dx += (slope * ox) / distance;
				dy += (slope * oy) / distance;
				height += Math.sin(wave) * fade;
			}
			const length = Math.hypot(dx, dy, 1);
			return material(-dx / length, -dy / length, 1 / length, hue + height * 22, intensity, 0.95, -0.6 + viewX * 2, -0.6 + viewY * 2);
		},
		160,
	);
	ctx.restore();
}
