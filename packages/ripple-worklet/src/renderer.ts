import { commonProperties, controls, drawable, number, TAU } from "../../core/src/index.ts";
import type { PaintContext, PaintSize, PaintProperties } from "../../core/src/types.ts";
export const inputProperties = [
	...commonProperties,
	"--ripple-rings",
	"--ripple-distortion",
	"--ripple-sources",
	"--ripple-position-x",
	"--ripple-position-y",
];

/** Draw intersecting, optically distorted wavefronts. @param ctx Paint context. @param size CSS-pixel dimensions. @param properties CSS inputs. */
export function paint(ctx: PaintContext, size: PaintSize, properties: PaintProperties): void {
	if (!drawable(size)) return;
	const { phase, hue, intensity, seed } = controls(properties);
	const rings = Math.floor(number(properties, "--ripple-rings", 50, 4, 90));
	const distortion = number(properties, "--ripple-distortion", 0.45, 0, 1.5);
	const sources = Math.floor(number(properties, "--ripple-sources", 2, 1, 4));
	const px = number(properties, "--ripple-position-x", size.width / 2, -size.width, size.width * 2);
	const py = number(properties, "--ripple-position-y", size.height / 2, -size.height, size.height * 2);
	const scale = Math.min(size.width, size.height);
	ctx.save();
	ctx.globalCompositeOperation = "lighter";
	for (let source = 0; source < sources; source++) {
		const orientation = (source / sources) * TAU + seed * 0.01;
		const cx = px + Math.cos(orientation + Math.sin(phase) * 0.25) * scale * (sources > 1 ? 0.18 : 0);
		const cy = py + Math.sin(orientation) * scale * 0.13;
		for (let ring = 0; ring < rings; ring++) {
			const f = (ring + 1) / rings;
			const radius = f * scale * 0.75;
			ctx.strokeStyle = `hsla(${hue + f * 140 + source * 35}, 85%, ${60 + Math.sin(f * Math.PI) * 22}%, ${Math.sin(f * Math.PI) * 0.65 * intensity})`;
			ctx.lineWidth = 0.6 + Math.sin(f * Math.PI) * 0.7;
			ctx.beginPath();
			for (let step = 0; step <= 128; step++) {
				const a = (step / 128) * TAU;
				const wave = Math.sin(a * 3 + phase + f * 7) * Math.cos(a * 2 - phase + f * 3);
				const r = radius + wave * scale * 0.055 * distortion * Math.sin(f * Math.PI);
				const x = cx + Math.cos(a) * r * 1.15,
					y = cy + Math.sin(a) * r * 0.82;
				if (step === 0) ctx.moveTo(x, y);
				else ctx.lineTo(x, y);
			}
			ctx.closePath();
			ctx.stroke();
		}
	}
	ctx.restore();
}
