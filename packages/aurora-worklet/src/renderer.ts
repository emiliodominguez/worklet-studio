import { commonProperties, controls, drawable, glow, number, TAU, token } from "../../core/src/index.ts";
import { material } from "../../core/src/surface.ts";
import type { PaintContext, PaintSize, PaintProperties } from "../../core/src/types.ts";
export const inputProperties = [...commonProperties, "--aurora-ribbons", "--aurora-spread", "--aurora-folds", "--aurora-tilt", "--aurora-mode"];

interface Vertex {
	x: number;
	y: number;
	z: number;
}

/** Sample a folded three-dimensional strip. @param u Along-strip angle. @param f Across-strip fraction. @param folds Fold count. @param spread Strip width. @param time Motion phase. @returns A point in model space. */
function ribbon(u: number, f: number, folds: number, spread: number, time: number): Vertex {
	const offset = (f - 0.5) * spread;
	const radius = 0.8 + 0.15 * Math.cos(folds * u + time) + offset * Math.cos(u + time);
	return {
		x: Math.cos(u) * radius * 1.25,
		y: Math.sin(u * folds) * 0.38 + Math.sin(u + time) * 0.12 + offset * Math.sin(u + time),
		z: Math.sin(u) * 0.55 + offset * Math.cos(u + time),
	};
}

/** Paint a luminous, folded ribbon sculpture or a curtain of auroral fibers. @param ctx Paint context. @param size CSS-pixel dimensions. @param properties CSS inputs. */
export function paint(ctx: PaintContext, size: PaintSize, properties: PaintProperties): void {
	if (!drawable(size)) return;
	const { phase, hue, intensity, seed, viewX, viewY } = controls(properties);
	const fibers = Math.floor(number(properties, "--aurora-ribbons", 110, 12, 180));
	const spread = number(properties, "--aurora-spread", 0.55, 0.05, 1.2);
	const folds = Math.round(number(properties, "--aurora-folds", 2, 1, 6));
	const tilt = (number(properties, "--aurora-tilt", -18, -180, 180) * Math.PI) / 180;
	const curtain = token(properties, "--aurora-mode", "ribbon") === "curtain";
	const t = phase + seed * 0.013;
	const scale = Math.min(size.width * 0.39, size.height * 0.53);
	ctx.save();
	ctx.globalCompositeOperation = "lighter";
	glow(ctx, size.width * 0.46, size.height * 0.48, scale * 0.95, `hsla(${hue}, 80%, 45%, ${0.1 * intensity})`);
	ctx.translate(size.width * 0.5 + viewX * scale * 0.08, size.height * 0.5 + viewY * scale * 0.08);
	ctx.rotate(tilt + viewX * 0.08);
	if (!curtain) {
		const faces = [];
		for (let along = 0; along < 128; along++) {
			for (let across = 0; across < 20; across++) {
				const u = (along / 128) * TAU,
					f = across / 20;
				const a = ribbon(u, f, folds, spread, t),
					b = ribbon(u + TAU / 128, f, folds, spread, t);
				const c = ribbon(u + TAU / 128, f + 0.05, folds, spread, t),
					d = ribbon(u, f + 0.05, folds, spread, t);
				const ax = b.x - a.x,
					ay = b.y - a.y,
					az = b.z - a.z,
					bx = d.x - a.x,
					by = d.y - a.y,
					bz = d.z - a.z;
				let nx = ay * bz - az * by,
					ny = az * bx - ax * bz,
					nz = ax * by - ay * bx;
				const length = Math.hypot(nx, ny, nz) || 1,
					direction = nz < 0 ? -1 : 1;
				nx *= direction / length;
				ny *= direction / length;
				nz *= direction / length;
				const e = ribbon(u + TAU / 128 + 0.001, f + 0.05, folds, spread, t),
					g = ribbon(u + TAU / 128, f + 0.051, folds, spread, t);
				const ex = e.x - c.x,
					ey = e.y - c.y,
					ez = e.z - c.z,
					gx = g.x - c.x,
					gy = g.y - c.y,
					gz = g.z - c.z;
				let qx = ey * gz - ez * gy,
					qy = ez * gx - ex * gz,
					qz = ex * gy - ey * gx;
				const qlength = Math.hypot(qx, qy, qz) || 1,
					qdirection = qz < 0 ? -1 : 1;
				qx *= qdirection / qlength;
				qy *= qdirection / qlength;
				qz *= qdirection / qlength;
				const endColor = material(
					qx,
					qy,
					qz,
					hue + Math.sin(u + TAU / 128) * 55 + (f + 0.05) * 40,
					intensity * 0.9,
					0.8,
					-0.45 + viewX,
					-0.65 + viewY,
				);
				faces.push({
					endColor,
					points: [a, b, c, d],
					depth: (a.z + b.z + c.z + d.z) / 4,
					color: material(nx, ny, nz, hue + Math.sin(u) * 55 + f * 40, intensity * 0.9, 0.8, -0.45 + viewX, -0.65 + viewY),
				});
			}
		}
		faces.sort(function depth(a, b) {
			return b.depth - a.depth;
		});
		ctx.globalCompositeOperation = "source-over";
		for (const face of faces) {
			const a = face.points[0],
				c = face.points[2];
			const gradient = ctx.createLinearGradient(a.x * scale, a.y * scale, c.x * scale, c.y * scale);
			gradient.addColorStop(0, face.color);
			gradient.addColorStop(1, face.endColor);
			ctx.fillStyle = gradient;
			ctx.strokeStyle = gradient;
			ctx.lineWidth = 0.65;
			ctx.beginPath();
			for (let i = 0; i < face.points.length; i++) {
				const point = face.points[i],
					perspective = 1 / (1 + point.z * 0.18);
				if (i) ctx.lineTo(point.x * scale * perspective, point.y * scale * perspective);
				else ctx.moveTo(point.x * scale * perspective, point.y * scale * perspective);
			}
			ctx.closePath();
			ctx.fill();
			ctx.stroke();
		}
		ctx.globalCompositeOperation = "lighter";
	}
	for (let fiber = 0; fiber < fibers; fiber++) {
		const f = fiber / (fibers - 1),
			offset = (f - 0.5) * spread;
		const gradient = ctx.createLinearGradient(-scale, -scale * 0.3, scale, scale * 0.3);
		gradient.addColorStop(0, `hsla(${hue - 90 + f * 45}, 95%, 60%, 0.15)`);
		gradient.addColorStop(0.3, `hsla(${hue - 25 + f * 70}, 95%, 72%, 0.8)`);
		gradient.addColorStop(0.65, `hsla(${hue + 65 + f * 40}, 95%, 70%, 0.95)`);
		gradient.addColorStop(1, `hsla(${hue + 130}, 90%, 65%, 0.15)`);
		ctx.strokeStyle = gradient;
		ctx.globalAlpha = (curtain ? 0.2 + Math.sin(f * Math.PI) * 0.6 : 0.06 + Math.pow(Math.abs(f - 0.5) * 2, 8) * 0.4) * Math.min(1.3, intensity);
		ctx.lineWidth = fiber % 9 === 0 ? 1.25 : 0.65;
		ctx.beginPath();
		for (let step = 0; step <= 144; step++) {
			const u = (step / 144) * TAU;
			let x: number, y: number;
			if (curtain) {
				x = (step / 144 - 0.5) * scale * 2.8;
				y = scale * (Math.sin(u * folds + t) * 0.19 + Math.cos(u - t) * 0.18 + offset * (0.35 + Math.sin(u / 2) * 0.9));
			} else {
				const point = ribbon(u, f, folds, spread, t),
					perspective = 1 / (1 + point.z * 0.18);
				x = point.x * scale * perspective;
				y = point.y * scale * perspective;
			}
			if (step === 0) ctx.moveTo(x, y);
			else ctx.lineTo(x, y);
		}
		if (curtain && fiber % 4 === 0) {
			ctx.lineWidth = 5;
			ctx.globalAlpha *= 0.15;
			ctx.stroke();
			ctx.lineWidth = 0.7;
			ctx.globalAlpha /= 0.15;
		}
		ctx.stroke();
	}
	ctx.restore();
}
