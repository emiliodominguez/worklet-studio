import { blur, commonProperties, controls, drawable, glow, number, random, TAU, token } from "../../core/src/index.ts";
import { noise } from "../../core/src/noise.ts";
import { spectrum } from "../../core/src/surface.ts";
import type { PaintContext, PaintSize, PaintProperties } from "../../core/src/types.ts";
export const inputProperties = [...commonProperties, "--aurora-ribbons", "--aurora-spread", "--aurora-folds", "--aurora-tilt", "--aurora-mode"];

interface Vertex {
	x: number;
	y: number;
	z: number;
}

interface Strip {
	depth: number;
	near: Vertex[];
	far: Vertex[];
	colors: string[];
}

const ALONG = 480,
	ACROSS = 12;

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

/** Project a model-space vertex with gentle perspective. @param point Model vertex. @param scale Screen scale. @returns Screen vertex retaining depth. */
function project(point: Vertex, scale: number): Vertex {
	const perspective = 1 / (1 + point.z * 0.18);
	return { x: point.x * scale * perspective, y: point.y * scale * perspective, z: point.z };
}

/** Normalize a vector, falling back to the view axis. @param x X. @param y Y. @param z Z. @returns Unit vector. */
function unit(x: number, y: number, z: number): Vertex {
	const length = Math.hypot(x, y, z);
	return length > 1e-9 ? { x: x / length, y: y / length, z: z / length } : { x: 0, y: 0, z: 1 };
}

/** Shade satin with an anisotropic fiber highlight, thin-film hue shift, and a Fresnel rim. @param tangent Unit fiber direction. @param normal Unit normal facing the viewer. @param back Whether the reverse face is visible. @param hue Base hue. @param intensity Exposure. @param light Unit light direction. @param half Unit half vector. @returns CSS color. */
function satin(tangent: Vertex, normal: Vertex, back: boolean, hue: number, intensity: number, light: Vertex, half: Vertex): string {
	const diffuse = Math.max(0, normal.x * light.x + normal.y * light.y + normal.z * light.z);
	const along = tangent.x * half.x + tangent.y * half.y + tangent.z * half.z;
	const fiber = Math.sqrt(Math.max(0, 1 - along * along));
	const sheen = Math.pow(fiber, 110) * 2.2 + Math.pow(fiber, 14) * 0.2;
	const rim = Math.pow(1 - Math.max(0, normal.z), 3);
	const film = hue + (1 - normal.z) * 95 + (back ? 38 : 0);
	const exposure = (0.04 + diffuse * (back ? 0.18 : 0.34) + sheen * (back ? 0.45 : 1) + rim * 0.7) * intensity;
	return spectrum(film, exposure, Math.max(0.12, 0.88 - sheen * 0.32 - rim * 0.2));
}

/** Paint a satin ribbon sculpture with continuous cross-section shading, bloom, and luminous edge threads. @param ctx Paint context. @param scale Screen scale. @param fibers Thread count. @param folds Fold count. @param spread Strip width. @param t Motion phase. @param hue Base hue. @param intensity Exposure. @param viewX Pointer offset. @param viewY Pointer offset. */
function sculpture(
	ctx: PaintContext,
	scale: number,
	fibers: number,
	folds: number,
	spread: number,
	t: number,
	hue: number,
	intensity: number,
	viewX: number,
	viewY: number,
): void {
	const light = unit(-0.45 + viewX * 1.4, -0.65 + viewY * 1.4, 1);
	const half = unit(light.x, light.y, light.z + 1);
	const step = TAU / ALONG,
		strips: Strip[] = [];
	for (let along = 0; along < ALONG; along++) {
		const u = along * step,
			near: Vertex[] = [],
			far: Vertex[] = [],
			colors: string[] = [];
		let depth = 0;
		for (let across = 0; across < ACROSS; across++) {
			const f = across / (ACROSS - 1);
			const point = ribbon(u, f, folds, spread, t);
			const du = ribbon(u + 0.002, f, folds, spread, t),
				df = ribbon(u, f + 0.002, folds, spread, t);
			const tangent = unit(du.x - point.x, du.y - point.y, du.z - point.z);
			const across3 = unit(df.x - point.x, df.y - point.y, df.z - point.z);
			const normal = unit(
				tangent.y * across3.z - tangent.z * across3.y,
				tangent.z * across3.x - tangent.x * across3.z,
				tangent.x * across3.y - tangent.y * across3.x,
			);
			const back = normal.z < 0;
			if (back) {
				normal.x = -normal.x;
				normal.y = -normal.y;
				normal.z = -normal.z;
			}
			colors.push(satin(tangent, normal, back, hue + Math.sin(u) * 50 + f * 36, intensity, light, half));
			depth += point.z;
			if (across === 0 || across === ACROSS - 1) {
				near.push(project(point, scale));
				far.push(project(ribbon(u + step * 1.4, f, folds, spread, t), scale));
			}
		}
		strips.push({ depth: depth / ACROSS, near, far, colors });
	}
	const exposure = Math.min(1.3, intensity);
	/** Build one horizontal spectral gradient shared by a whole blurred or sharp pass. @param lightness Lightness percentage. @param alpha Peak opacity. @returns Gradient. */
	function sweep(lightness: number, alpha: number): CanvasGradient {
		const gradient = ctx.createLinearGradient(-scale * 1.3, -scale * 0.3, scale * 1.3, scale * 0.3);
		for (let stop = 0; stop <= 4; stop++)
			gradient.addColorStop(stop / 4, `hsla(${hue - 50 + stop * 40}, 92%, ${lightness}%, ${alpha * (stop % 4 ? 1 : 0.35)})`);
		return gradient;
	}
	/** Trace one or more full-length lines along the strip into the current path. @param fractions Across-strip fractions. @param samples Samples per loop. */
	function trace(fractions: number[], samples: number): void {
		ctx.beginPath();
		for (const f of fractions) {
			for (let along = 0; along <= samples; along++) {
				const point = project(ribbon((along / samples) * TAU, f, folds, spread, t), scale);
				if (along) ctx.lineTo(point.x, point.y);
				else ctx.moveTo(point.x, point.y);
			}
		}
	}
	ctx.save();
	ctx.globalCompositeOperation = "lighter";
	blur(ctx, scale * 0.06);
	ctx.lineCap = "round";
	ctx.lineJoin = "round";
	ctx.lineWidth = Math.max(2, spread * scale * 0.55);
	ctx.strokeStyle = sweep(50, 0.12 * exposure);
	trace([0.5], 160);
	ctx.stroke();
	ctx.restore();
	strips.sort(function depth(a, b) {
		return b.depth - a.depth;
	});
	for (const strip of strips) {
		const [a0, a1] = strip.near,
			[b0, b1] = strip.far;
		const gradient = ctx.createLinearGradient(a0.x, a0.y, a1.x, a1.y);
		for (let i = 0; i < strip.colors.length; i++) gradient.addColorStop(i / (strip.colors.length - 1), strip.colors[i]);
		ctx.fillStyle = gradient;
		ctx.beginPath();
		ctx.moveTo(a0.x, a0.y);
		ctx.lineTo(b0.x, b0.y);
		ctx.lineTo(b1.x, b1.y);
		ctx.lineTo(a1.x, a1.y);
		ctx.closePath();
		ctx.fill();
	}
	ctx.globalCompositeOperation = "lighter";
	ctx.save();
	blur(ctx, 5);
	ctx.lineWidth = 3;
	ctx.strokeStyle = sweep(78, 0.6 * exposure);
	trace([0, 1], 240);
	ctx.stroke();
	ctx.restore();
	ctx.lineWidth = 0.9;
	ctx.strokeStyle = sweep(84, 0.5 * exposure);
	trace([0, 1], ALONG);
	ctx.stroke();
	ctx.lineWidth = 0.5;
	for (let fiber = 0; fiber < fibers; fiber++) {
		const f = (fiber + 0.5) / fibers;
		const grain = 0.5 + 0.5 * Math.sin(fiber * 12.9898 + 4.1);
		ctx.strokeStyle = `hsla(${hue + f * 80 - 20}, 90%, 80%, 1)`;
		ctx.globalAlpha = (0.015 + grain * grain * 0.05) * Math.min(1.3, intensity);
		ctx.beginPath();
		for (let along = 0; along <= 180; along++) {
			const point = project(ribbon((along / 180) * TAU, f, folds, spread, t), scale);
			if (along) ctx.lineTo(point.x, point.y);
			else ctx.moveTo(point.x, point.y);
		}
		ctx.stroke();
	}
	ctx.globalAlpha = 1;
}

/** Hash an integer into a stable fraction for ray jitter. @param value Integer key. @returns Fraction in [0, 1). */
function hash(value: number): number {
	const x = Math.sin(value * 91.3458) * 47453.5453;
	return x - Math.floor(x);
}

/** Locate a point on a folded auroral curtain. @param s Curtain fraction. @param layer Curtain index. @param folds Fold count. @param spread Fold depth. @param t Motion phase. @param seed Variation seed. @returns Normalized base position. */
function curtainBase(s: number, layer: number, folds: number, spread: number, t: number, seed: number): { x: number; y: number } {
	const wander = noise(s * 2.2 + Math.cos(t) * 0.35 + layer * 5, Math.sin(t) * 0.35 + layer * 3, seed + layer * 31);
	return {
		x:
			-0.12 +
			s * 1.24 +
			Math.sin(s * folds * Math.PI * 1.6 + t + layer * 2.1) * 0.11 * spread +
			Math.sin(s * folds * 7.3 - t * 2 + layer) * 0.022 * spread +
			wander * 0.03,
		y: Math.sin(s * folds * 2.3 + t * (layer ? -1 : 1) + layer) * 0.09 + (0.5 - s) * (0.1 + Math.cos(t) * 0.04) + wander * 0.07,
	};
}

/** Paint rayed auroral curtains: green lower edges, red and violet upper rays, fold brightening, airglow, and stars. @param ctx Paint context. @param size CSS dimensions. @param fibers Ray density control. @param folds Fold count. @param spread Fold depth. @param tilt Curtain tilt. @param t Motion phase. @param seed Variation seed. @param hue Base hue. @param intensity Exposure. @param viewX Pointer offset. @param viewY Pointer offset. */
function curtains(
	ctx: PaintContext,
	size: PaintSize,
	fibers: number,
	folds: number,
	spread: number,
	tilt: number,
	t: number,
	seed: number,
	hue: number,
	intensity: number,
	viewX: number,
	viewY: number,
): void {
	const { width, height } = size,
		next = random(seed);
	const sky = ctx.createLinearGradient(0, 0, 0, height);
	sky.addColorStop(0, "rgba(2, 4, 12, 0.85)");
	sky.addColorStop(0.65, `hsla(${hue + 50}, 60%, 9%, 0.6)`);
	sky.addColorStop(1, `hsla(${hue + 40}, 45%, 6%, 0.7)`);
	ctx.fillStyle = sky;
	ctx.fillRect(0, 0, width, height);
	ctx.globalCompositeOperation = "lighter";
	for (let star = 0; star < 170; star++) {
		const x = next() * width + viewX * 6,
			y = next() * height * 0.95 + viewY * 6,
			bright = next();
		ctx.fillStyle = `rgba(220, 232, 255, ${(0.12 + bright * bright * 0.6) * (0.85 + Math.sin(t * 3 + star) * 0.15)})`;
		ctx.beginPath();
		ctx.arc(x, y, 0.35 + bright * 0.75, 0, TAU);
		ctx.fill();
	}
	ctx.save();
	ctx.translate(width / 2, height / 2);
	ctx.rotate(tilt * 0.12);
	ctx.translate(-width / 2, -height / 2);
	const rays = Math.round(fibers * 2.6);
	for (let layer = 1; layer >= 0; layer--) {
		const far = layer === 1,
			parallax = far ? 0.02 : 0.06;
		const baseY = height * (far ? 0.5 : 0.74) - viewY * height * parallax,
			shift = -viewX * width * parallax;
		const tall = height * (far ? 0.34 : 0.62),
			strength = (far ? 0.5 : 1) * intensity;
		const count = far ? Math.round(rays * 0.6) : rays;
		const base: { x: number; y: number; h: number; b: number; s: number }[] = [];
		for (let i = 0; i <= count; i++) {
			const s = i / count,
				point = curtainBase(s, layer, folds, spread, t, seed);
			const flicker = noise(s * 70 + Math.cos(t) * 1.5, Math.sin(t) * 1.5 + layer * 9, seed + 7);
			const pulse = noise(s * 9 - Math.sin(t) * 0.8, Math.cos(t) * 0.8, seed + 19);
			const h =
				tall *
				(0.58 +
					0.3 * noise(s * 5 + Math.cos(t) * 0.4, layer * 4 + Math.sin(t) * 0.4, seed + 3) +
					flicker * 0.14 +
					(hash(i * 3 + layer) - 0.5) * 0.16);
			const envelope = Math.sin(Math.min(1, Math.max(0, (s - 0.05) / 0.9)) * Math.PI);
			const jitter = hash(i + layer * 977) - 0.5;
			base.push({
				x: point.x * width + shift + jitter * ((width * 1.24) / count) * 1.6,
				s: point.x * width,
				y: baseY + point.y * height,
				h,
				b: Math.max(0.06, Math.min(1.5, 0.5 + flicker * 0.4 + pulse * 0.55)) * envelope,
			});
		}
		ctx.save();
		blur(ctx, height * (far ? 0.018 : 0.024));
		const body = ctx.createLinearGradient(0, baseY + height * 0.1, 0, baseY - tall);
		body.addColorStop(0, `hsla(${hue - 25}, 95%, 55%, 0)`);
		body.addColorStop(0.06, `hsla(${hue - 25}, 95%, 55%, 0)`);
		body.addColorStop(0.14, `hsla(${hue - 25}, 95%, 55%, ${0.55 * strength})`);
		body.addColorStop(0.4, `hsla(${hue - 10}, 90%, 42%, ${0.32 * strength})`);
		body.addColorStop(0.78, `hsla(${hue + 170}, 80%, 45%, ${0.16 * strength})`);
		body.addColorStop(1, `hsla(${hue + 190}, 80%, 40%, 0)`);
		ctx.fillStyle = body;
		ctx.beginPath();
		ctx.moveTo(base[0].x, base[0].y);
		for (const ray of base) ctx.lineTo(ray.x, ray.y);
		for (let i = base.length - 1; i >= 0; i--) ctx.lineTo(base[i].x, base[i].y - base[i].h * 0.7);
		ctx.closePath();
		ctx.fill();
		ctx.restore();
		for (let i = 1; i < base.length; i++) {
			const ray = base[i],
				previous = base[i - 1];
			const fold = Math.min(2.4, ((width / count) * 1.24) / Math.max(0.25, Math.abs(ray.s - previous.s)));
			const alpha = Math.min(1, ray.b * (0.2 + fold * 0.2) * strength);
			if (alpha < 0.01) continue;
			const gradient = ctx.createLinearGradient(ray.x, ray.y + 3, ray.x, ray.y - ray.h);
			gradient.addColorStop(0, `hsla(${hue + 150}, 90%, 70%, 0)`);
			gradient.addColorStop(0.015, `hsla(${hue + 140}, 85%, 70%, ${alpha * 0.55})`);
			gradient.addColorStop(0.05, `hsla(${hue - 35}, 100%, 74%, ${alpha})`);
			gradient.addColorStop(0.22, `hsla(${hue - 25}, 95%, 58%, ${alpha * 0.55})`);
			gradient.addColorStop(0.55, `hsla(${hue + 10}, 85%, 50%, ${alpha * 0.18})`);
			gradient.addColorStop(0.75, `hsla(${hue + 175}, 85%, 55%, ${alpha * 0.26})`);
			gradient.addColorStop(1, `hsla(${hue + 200}, 80%, 55%, 0)`);
			ctx.strokeStyle = gradient;
			ctx.lineWidth = Math.max(0.5, ((width * 1.24) / count) * (far ? 0.8 : 1.1) * (0.5 + ray.b * 0.5));
			ctx.beginPath();
			ctx.moveTo(ray.x, ray.y + 3);
			ctx.lineTo(ray.x + (ray.x - width / 2) * 0.02, ray.y - ray.h);
			ctx.stroke();
		}
		ctx.save();
		blur(ctx, 3);
		ctx.strokeStyle = `hsla(${hue - 35}, 100%, 72%, ${0.3 * strength})`;
		ctx.lineWidth = far ? 1.5 : 2.5;
		ctx.beginPath();
		for (let i = 0; i < base.length; i++) {
			if (i) ctx.lineTo(base[i].x, base[i].y);
			else ctx.moveTo(base[i].x, base[i].y);
		}
		ctx.stroke();
		ctx.restore();
	}
	ctx.restore();
	glow(ctx, width * 0.5, height * 1.1, width * 0.55, `hsla(${hue - 20}, 90%, 40%, ${0.05 * intensity})`);
}

/** Paint a satin ribbon sculpture or rayed auroral curtains. @param ctx Paint context. @param size CSS-pixel dimensions. @param properties CSS inputs. */
export function paint(ctx: PaintContext, size: PaintSize, properties: PaintProperties): void {
	if (!drawable(size)) return;
	const { phase, hue, intensity, seed, viewX, viewY } = controls(properties);
	const fibers = Math.floor(number(properties, "--aurora-ribbons", 110, 12, 180));
	const spread = number(properties, "--aurora-spread", 0.55, 0.05, 1.2);
	const folds = Math.round(number(properties, "--aurora-folds", 2, 1, 6));
	const tilt = (number(properties, "--aurora-tilt", -18, -180, 180) * Math.PI) / 180;
	const curtain = token(properties, "--aurora-mode", "ribbon") === "curtain";
	const t = phase + seed * 0.013;
	ctx.save();
	if (curtain) curtains(ctx, size, fibers, folds, spread, tilt, t, seed, hue, intensity, viewX, viewY);
	else {
		const scale = Math.min(size.width * 0.39, size.height * 0.53);
		ctx.globalCompositeOperation = "lighter";
		glow(ctx, size.width * 0.46, size.height * 0.48, scale * 1.1, `hsla(${hue}, 80%, 40%, ${0.09 * intensity})`);
		ctx.globalCompositeOperation = "source-over";
		ctx.translate(size.width * 0.5 + viewX * scale * 0.08, size.height * 0.5 + viewY * scale * 0.08);
		ctx.rotate(tilt + viewX * 0.08);
		sculpture(ctx, scale, fibers, folds, spread, t, hue, intensity, viewX, viewY);
	}
	ctx.restore();
}
