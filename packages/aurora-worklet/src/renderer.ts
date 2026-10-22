import { commonProperties, controls, drawable, glow, number, TAU, token } from "../../core/src/index.ts";
import type { PaintContext, PaintSize, PaintProperties } from "../../core/src/types.ts";
export const inputProperties = [...commonProperties, "--aurora-ribbons", "--aurora-spread", "--aurora-folds", "--aurora-tilt", "--aurora-mode"];

/** Paint a luminous, folded ribbon sculpture or a curtain of auroral fibers. @param ctx Paint context. @param size CSS-pixel dimensions. @param properties CSS inputs. */
export function paint(ctx: PaintContext, size: PaintSize, properties: PaintProperties): void {
	if (!drawable(size)) return;
	const { phase, hue, intensity, seed } = controls(properties);
	const fibers = Math.floor(number(properties, "--aurora-ribbons", 110, 12, 180));
	const spread = number(properties, "--aurora-spread", 0.55, 0.05, 1.2);
	const folds = Math.round(number(properties, "--aurora-folds", 2, 1, 6));
	const tilt = (number(properties, "--aurora-tilt", -18, -180, 180) * Math.PI) / 180;
	const curtain = token(properties, "--aurora-mode", "ribbon") === "curtain";
	const t = phase + seed * 0.013;
	const scale = Math.min(size.width * 0.43, size.height * 0.68);
	ctx.save();
	ctx.globalCompositeOperation = "lighter";
	glow(ctx, size.width * 0.46, size.height * 0.48, scale * 0.95, `hsla(${hue}, 80%, 45%, ${0.1 * intensity})`);
	ctx.translate(size.width / 2, size.height / 2);
	ctx.rotate(tilt);
	for (let fiber = 0; fiber < fibers; fiber++) {
		const f = fiber / (fibers - 1),
			offset = (f - 0.5) * spread;
		const gradient = ctx.createLinearGradient(-scale, -scale * 0.3, scale, scale * 0.3);
		gradient.addColorStop(0, `hsla(${hue - 90 + f * 45}, 95%, 60%, 0.15)`);
		gradient.addColorStop(0.3, `hsla(${hue - 25 + f * 70}, 95%, 72%, 0.8)`);
		gradient.addColorStop(0.65, `hsla(${hue + 65 + f * 40}, 95%, 70%, 0.95)`);
		gradient.addColorStop(1, `hsla(${hue + 130}, 90%, 65%, 0.15)`);
		ctx.strokeStyle = gradient;
		ctx.globalAlpha = (0.2 + Math.sin(f * Math.PI) * 0.6) * Math.min(1.3, intensity);
		ctx.lineWidth = fiber % 9 === 0 ? 1.25 : 0.65;
		ctx.beginPath();
		for (let step = 0; step <= 144; step++) {
			const u = (step / 144) * TAU;
			let x: number, y: number;
			if (curtain) {
				x = (step / 144 - 0.5) * scale * 2.8;
				y = scale * (Math.sin(u * folds + t) * 0.19 + Math.cos(u - t) * 0.18 + offset * (0.35 + Math.sin(u / 2) * 0.9));
			} else {
				const radius = 0.8 + 0.15 * Math.cos(folds * u + t) + offset * Math.cos(u + t);
				x = Math.cos(u) * radius * scale * 1.25;
				y = (Math.sin(u * folds) * 0.38 + Math.sin(u + t) * 0.12 + offset * Math.sin(u + t)) * scale;
			}
			if (step === 0) ctx.moveTo(x, y);
			else ctx.lineTo(x, y);
		}
		ctx.stroke();
	}
	ctx.restore();
}
