import { commonProperties, controls, drawable, number, TAU } from "../../core/src/index.ts";
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

/** Paint smooth spectral bands with contour-line microstructure, without pixel APIs. @param ctx Paint context. @param size CSS-pixel dimensions. @param properties CSS inputs. */
export function paint(ctx: PaintContext, size: PaintSize, properties: PaintProperties): void {
	if (!drawable(size)) return;
	const { phase, hue, intensity, seed } = controls(properties);
	const frequency = number(properties, "--iridescence-scale", 2.4, 0.3, 8);
	const ridges = number(properties, "--iridescence-ridges", 0.55, 0, 1);
	const shimmer = number(properties, "--iridescence-shimmer", 0.65, 0, 1);
	const metallic = number(properties, "--iridescence-metallic", 0.65, 0, 1);
	const px = number(properties, "--iridescence-position-x", 0.5, 0, 1);
	const py = number(properties, "--iridescence-position-y", 0.5, 0, 1);
	const strips = 240,
		steps = 48;
	const t = phase + seed * 0.019;
	ctx.save();
	for (let row = -2; row <= strips + 2; row++) {
		const v = row / strips;
		const gradient = ctx.createLinearGradient(0, 0, size.width, 0);
		for (let stop = 0; stop <= 64; stop++) {
			const u = stop / 64;
			const field = Math.sin(u * frequency * 2 + Math.sin(t) + px * 2) + Math.cos(v * frequency * 3 - Math.cos(t) + py * 2);
			const sheen = Math.pow(Math.max(0, Math.sin(field * 2 + v * 5 + t)), 8) * shimmer;
			const reflection = Math.pow(Math.max(0, Math.cos(field * 2.5 + u * 4 - py * 2)), 8) * metallic;
			const light = Math.min(96, 12 + intensity * (16 + sheen * 26 + reflection * 50 + Math.sin(field * 3) * 10));
			gradient.addColorStop(u, `hsl(${hue + field * 80 + v * 120}, ${Math.max(8, 65 - metallic * 20 - reflection * 42)}%, ${light}%)`);
		}
		ctx.fillStyle = gradient;
		ctx.beginPath();
		for (let edge = 0; edge < 2; edge++) {
			for (let i = 0; i <= steps; i++) {
				const u = (edge ? steps - i : i) / steps;
				const edgeV = v + edge / strips;
				const warp = Math.sin(u * TAU + t) * Math.sin(edgeV * Math.PI) * size.height * 0.08;
				const y = edgeV * size.height + warp + (edge ? 0.8 : 0);
				if (edge === 0 && i === 0) ctx.moveTo(u * size.width, y);
				else ctx.lineTo(u * size.width, y);
			}
		}
		ctx.closePath();
		ctx.fill();
		if (row % 3 === 0 && ridges > 0) {
			ctx.strokeStyle = `rgba(240, 245, 255, ${ridges * 0.13})`;
			ctx.lineWidth = 0.4;
			ctx.beginPath();
			for (let i = 0; i <= steps; i++) {
				const u = i / steps;
				const y = v * size.height + Math.sin(u * TAU + t) * Math.sin(v * Math.PI) * size.height * 0.08;
				if (i === 0) ctx.moveTo(u * size.width, y);
				else ctx.lineTo(u * size.width, y);
			}
			ctx.stroke();
		}
	}
	ctx.restore();
}
