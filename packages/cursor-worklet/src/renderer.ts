import { color, commonProperties, controls, drawable, glow, number, TAU, token } from "../../core/src/index.ts";
import type { PaintContext, PaintSize, PaintProperties } from "../../core/src/types.ts";
export const inputProperties = [
	...commonProperties,
	"--cursor-ripples",
	"--cursor-size",
	"--cursor-border-size",
	"--cursor-fill-color",
	"--cursor-stroke-color",
	"--cursor-color-intensity",
	"--cursor-position-x",
	"--cursor-position-y",
	"--cursor-mode",
	"--cursor-orbit",
	"--cursor-glow",
];

/** Paint legacy rings or a luminous orbital cursor. @param ctx Paint context. @param size CSS-pixel dimensions. @param properties CSS inputs. */
export function paint(ctx: PaintContext, size: PaintSize, properties: PaintProperties): void {
	if (!drawable(size)) return;
	const { phase: time, hue, intensity, seed } = controls(properties);
	const phase = time + (seed - 42) * 0.013;
	const x = number(properties, "--cursor-position-x", size.width / 2, -size.width, size.width * 2);
	const y = number(properties, "--cursor-position-y", size.height / 2, -size.height, size.height * 2);
	const radius = number(properties, "--cursor-size", 18, 0, 250);
	const rings = Math.floor(number(properties, "--cursor-ripples", 5, 0, 24));
	const width = number(properties, "--cursor-border-size", 1, 0, 20);
	const opacity = number(properties, "--cursor-color-intensity", 0.6, 0, 1) * intensity;
	const mode = token(properties, "--cursor-mode", "rings");
	ctx.save();
	if (mode === "orbit") {
		const orbit = number(properties, "--cursor-orbit", 1, 0.1, 3);
		const bloom = number(properties, "--cursor-glow", 1, 0, 2);
		ctx.globalCompositeOperation = "lighter";
		glow(ctx, x, y, radius * 6 * bloom, `hsla(${hue}, 95%, 60%, ${opacity * 0.3})`);
		for (let ring = 0; ring < rings; ring++) {
			const r = radius * (1.3 + ring * 0.65) * orbit;
			ctx.strokeStyle = `hsla(${hue + ring * 23}, 90%, 75%, ${opacity * 0.7})`;
			if (width) ctx.lineWidth = width;
			ctx.beginPath();
			ctx.ellipse(x, y, r, r * (0.35 + 0.12 * Math.sin(phase + ring)), phase + ring * 0.65, 0, TAU);
			if (width) ctx.stroke();
			const angle = phase + ring * 1.7;
			glow(ctx, x + Math.cos(angle) * r, y + Math.sin(angle) * r, Math.max(2, radius * 0.6), `hsla(${hue + ring * 25}, 100%, 80%, ${opacity})`);
		}
		glow(ctx, x, y, radius * 1.8, `hsla(${hue + 30}, 90%, 90%, ${opacity})`);
	} else {
		ctx.fillStyle = color(token(properties, "--cursor-fill-color", `hsl(${hue}, 80%, 70%)`));
		ctx.strokeStyle = color(token(properties, "--cursor-stroke-color", `hsl(${hue}, 90%, 85%)`));
		if (width) ctx.lineWidth = width;
		const progress = (((phase / TAU) % 1) + 1) % 1;
		for (let ring = 0; ring < rings; ring++) {
			const age = ring + progress;
			ctx.globalAlpha = Math.min(1, opacity * (1 - age / rings));
			ctx.beginPath();
			ctx.arc(x, y, radius * age * 1.5, 0, TAU);
			ctx.fill();
			if (width) ctx.stroke();
		}
	}
	ctx.restore();
}
