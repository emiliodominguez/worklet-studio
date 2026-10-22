import { color, commonProperties, controls, drawable, glow, number, TAU, token } from "../../core/src/index.ts";
import type { PaintContext, PaintSize, PaintProperties } from "../../core/src/types.ts";
import { parseTrail, smoothTrail } from "./trails.ts";
import type { TrailPoint } from "./trails.ts";

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
	"--cursor-trail",
	"--cursor-press",
	"--cursor-twist",
	"--cursor-speed",
];

/** Draw a spectral segment with explicit width and alpha. @param ctx Context. @param a Start. @param b End. @param hue Color hue. @param alpha Opacity. @param width Stroke width. */
function segment(ctx: PaintContext, a: TrailPoint, b: TrailPoint, hue: number, alpha: number, width: number): void {
	ctx.strokeStyle = `hsla(${hue}, 95%, 72%, ${Math.min(1, alpha)})`;
	ctx.lineWidth = Math.max(0.1, width);
	ctx.beginPath();
	ctx.moveTo(a.x, a.y);
	ctx.lineTo(b.x, b.y);
	ctx.stroke();
}

/** Paint six cursor materials, retaining the original ripple controls. @param ctx Paint context. @param size CSS dimensions. @param properties CSS inputs. */
export function paint(ctx: PaintContext, size: PaintSize, properties: PaintProperties): void {
	if (!drawable(size)) return;
	const { phase: time, hue, intensity, seed } = controls(properties);
	const phase = time + (seed - 42) * 0.013;
	const x = number(properties, "--cursor-position-x", size.width / 2, -size.width, size.width * 2);
	const y = number(properties, "--cursor-position-y", size.height / 2, -size.height, size.height * 2);
	const press = number(properties, "--cursor-press", 0, 0, 1);
	const radius = number(properties, "--cursor-size", 18, 0, 250) * (1 - press * 0.22);
	const rings = Math.floor(number(properties, "--cursor-ripples", 5, 0, 24));
	const width = number(properties, "--cursor-border-size", 1, 0, 20);
	const opacity = number(properties, "--cursor-color-intensity", 0.6, 0, 1) * intensity;
	const mode = token(properties, "--cursor-mode", "rings");
	const bloom = number(properties, "--cursor-glow", 1, 0, 2);
	const twist = number(properties, "--cursor-twist", 1, 0, 3);
	const speed = number(properties, "--cursor-speed", 0, 0, 60);
	ctx.save();
	ctx.lineCap = "round";
	ctx.lineJoin = "round";
	if (mode === "rings") {
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
		ctx.restore();
		return;
	}
	ctx.globalCompositeOperation = "lighter";
	glow(ctx, x, y, radius * (4 + press * 3) * bloom, `hsla(${hue}, 90%, 55%, ${opacity * 0.13})`);
	if (mode === "ribbon" || mode === "comet") {
		let points = parseTrail(token(properties, "--cursor-trail", ""));
		if (points.length < 2) {
			points = [];
			for (let i = 0; i < 24; i++) {
				const u = i / 23;
				points.push({ x: x - u * radius * 7, y: y + Math.sin(u * 5 - phase) * radius * 1.4 * Math.sin((u * Math.PI) / 2) });
			}
		}
		points = smoothTrail(points);
		if (mode === "ribbon") {
			const strands = Math.max(4, Math.min(18, rings * 2));
			for (let strand = 0; strand < strands; strand++) {
				let previous: TrailPoint | undefined;
				const offset = strand / (strands - 1) - 0.5;
				for (let i = 0; i < points.length; i++) {
					const u = i / (points.length - 1),
						point = points[i],
						next = points[Math.min(i + 1, points.length - 1)];
					const dx = next.x - point.x,
						dy = next.y - point.y,
						length = Math.hypot(dx, dy) || 1;
					const spread = Math.sin(u * Math.PI) * radius * (1.3 + speed * 0.025);
					const wave = offset * spread * Math.sin(u * TAU * twist + phase + offset * 1.5);
					const p = { x: point.x - (dy / length) * wave, y: point.y + (dx / length) * wave };
					if (previous) segment(ctx, previous, p, hue + offset * 95 + u * 45, opacity * Math.pow(1 - u, 0.6) * 0.7, 0.8 + (1 - u) * 1.3);
					previous = p;
				}
			}
		} else {
			for (let pass = 0; pass < 3; pass++) {
				for (let i = 1; i < points.length; i++) {
					const u = i / points.length;
					segment(
						ctx,
						points[i - 1],
						points[i],
						hue + u * 75,
						opacity * (1 - u) * [0.055 * bloom, 0.22, 0.85][pass],
						Math.max(0.2, radius * [1.6, 0.6, 0.1][pass] * (1 - u)),
					);
				}
			}
			for (let i = 4; i < points.length; i += 5) {
				const u = i / points.length,
					p = points[i];
				const scatter = Math.sin(i * 3.7 + phase) * radius * u;
				glow(
					ctx,
					p.x + scatter * 0.6,
					p.y + scatter,
					Math.max(1, radius * 0.16 * (1 - u)),
					`hsla(${hue + 60 * u}, 95%, 80%, ${opacity * (1 - u)})`,
				);
			}
		}
		glow(ctx, x, y, radius * 0.75 * bloom, `hsla(${hue}, 100%, 75%, ${opacity})`);
		ctx.fillStyle = `rgba(245, 250, 255, ${Math.min(1, opacity)})`;
		ctx.beginPath();
		ctx.arc(x, y, Math.max(0.5, radius * 0.08), 0, TAU);
		ctx.fill();
	} else if (mode === "plasma") {
		for (let line = 0; line < 42; line++) {
			const f = line / 41,
				r = radius * (0.5 + f * 1.5);
			ctx.strokeStyle = `hsla(${hue + f * 100}, 95%, ${65 + Math.sin(f * Math.PI) * 20}%, ${opacity * (0.25 + f * 0.55)})`;
			ctx.lineWidth = line % 7 === 0 ? 1.4 : 0.65;
			ctx.beginPath();
			for (let step = 0; step <= 120; step++) {
				const a = (step / 120) * TAU;
				const wobble = 1 + Math.sin(a * 3 + phase + f * 8) * 0.13 * twist + Math.cos(a * 5 - phase + f * 4) * 0.06;
				const px = x + Math.cos(a) * r * wobble,
					py = y + Math.sin(a) * r * wobble;
				if (!step) ctx.moveTo(px, py);
				else ctx.lineTo(px, py);
			}
			ctx.closePath();
			ctx.stroke();
		}
		glow(ctx, x - radius * 0.4, y - radius * 0.4, radius * 1.2 * bloom, `hsla(${hue + 35}, 95%, 80%, ${opacity * 0.25})`);
	} else if (mode === "lens") {
		for (let channel = 0; channel < 3; channel++) {
			const r = radius * (1.8 + channel * 0.055);
			const gradient = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
			gradient.addColorStop(0, `hsla(${hue + channel * 55}, 100%, 85%, ${opacity})`);
			gradient.addColorStop(0.3, `hsla(${hue + 80}, 80%, 60%, 0.03)`);
			gradient.addColorStop(0.7, `hsla(${hue + 100 + channel * 30}, 100%, 80%, ${opacity * 0.8})`);
			gradient.addColorStop(1, "transparent");
			ctx.strokeStyle = gradient;
			ctx.lineWidth = Math.max(0.3, width * (channel === 1 ? 2.5 : 1));
			ctx.beginPath();
			ctx.ellipse(x, y, r, r * (0.95 + Math.sin(phase) * 0.05), Math.sin(phase) * 0.2, 0, TAU);
			ctx.stroke();
		}
		glow(ctx, x - radius * 0.7, y - radius * 0.85, radius * 0.65 * bloom, `hsla(${hue}, 80%, 90%, ${opacity * 0.4})`);
		ctx.fillStyle = `rgba(225, 240, 255, ${opacity * 0.75})`;
		ctx.beginPath();
		ctx.arc(x, y, 1.5, 0, TAU);
		ctx.fill();
	} else {
		const orbit = number(properties, "--cursor-orbit", 1, 0.1, 3);
		for (let ring = 0; ring < rings; ring++) {
			const r = radius * (1.3 + ring * 0.5) * orbit,
				squash = 0.25 + 0.15 * Math.sin(phase + ring);
			const tilt = phase + ring * 0.7,
				a = phase * 2 + ring * 1.7;
			ctx.strokeStyle = `hsla(${hue + ring * 18}, 90%, 75%, ${opacity * 0.5})`;
			if (width) ctx.lineWidth = width;
			ctx.beginPath();
			ctx.ellipse(x, y, r, r * squash, tilt, 0, TAU);
			if (width) ctx.stroke();
			const px = x + Math.cos(a) * r * Math.cos(tilt) - Math.sin(a) * r * squash * Math.sin(tilt);
			const py = y + Math.cos(a) * r * Math.sin(tilt) + Math.sin(a) * r * squash * Math.cos(tilt);
			glow(ctx, px, py, Math.max(1, radius * 0.4 * bloom), `hsla(${hue + ring * 18}, 100%, 80%, ${opacity})`);
			ctx.fillStyle = `rgba(240, 248, 255, ${Math.min(1, opacity)})`;
			ctx.beginPath();
			ctx.arc(px, py, Math.max(0.5, radius * 0.045), 0, TAU);
			ctx.fill();
		}
		glow(ctx, x, y, radius * 1.2 * bloom, `hsla(${hue + 30}, 90%, 90%, ${opacity * 0.65})`);
	}
	ctx.restore();
}
