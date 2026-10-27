import { blur, commonProperties, controls, drawable, glow, number, random, TAU } from "../../core/src/index.ts";
import type { PaintContext, PaintSize, PaintProperties } from "../../core/src/types.ts";
export const inputProperties = [...commonProperties, "--flow-density", "--flow-turbulence", "--flow-length", "--flow-vortex"];

interface Stream {
	points: number[];
	tint: number;
	depth: number;
	light: number;
}

const BUCKETS = 2;

/** Trace one streamline through the animated field. @param x Start x. @param y Start y. @param steps Integration steps. @param field Field parameters. @returns Interleaved x/y coordinates. */
function trace(
	x: number,
	y: number,
	steps: number,
	field: { width: number; height: number; scale: number; turbulence: number; vortex: number; phase: number; viewX: number; viewY: number },
): number[] {
	const points = [x, y];
	const cx = field.width * (0.5 + field.viewX * 0.15),
		cy = field.height * (0.5 + field.viewY * 0.15),
		stride = field.scale * 0.007;
	for (let step = 0; step < steps; step++) {
		const nx = (x - cx) / field.scale,
			ny = (y - cy) / field.scale;
		const angle =
			Math.sin(nx * field.turbulence * 3 + Math.sin(field.phase) * 0.7) + Math.cos(ny * field.turbulence * 3 - Math.cos(field.phase) * 0.7);
		const orbit = Math.atan2(ny, nx) + Math.PI / 2;
		const blend = Math.min(0.94, field.vortex / (1 + Math.hypot(nx, ny) * 3));
		x += (Math.cos(angle * TAU * 0.3) * (1 - blend) + Math.cos(orbit) * blend) * stride;
		y += (Math.sin(angle * TAU * 0.3) * (1 - blend) + Math.sin(orbit) * blend) * stride;
		points.push(x, y);
	}
	return points;
}

/** Append a polyline to the current path. @param ctx Paint context. @param points Interleaved coordinates. @param from First vertex index to include. */
function polyline(ctx: PaintContext, points: number[], from = 0): void {
	ctx.moveTo(points[from * 2], points[from * 2 + 1]);
	for (let i = from * 2 + 2; i < points.length; i += 2) ctx.lineTo(points[i], points[i + 1]);
}

/** Fill a streamline as a ribbon that tapers from a hairline tail to a rounded head. @param ctx Paint context. @param points Interleaved coordinates. @param width Head width. */
function ribbon(ctx: PaintContext, points: number[], width: number): void {
	const count = points.length / 2,
		left: number[] = [],
		right: number[] = [];
	for (let i = 0; i < count; i++) {
		const a = Math.max(0, i - 1),
			b = Math.min(count - 1, i + 1);
		let dx = points[b * 2] - points[a * 2],
			dy = points[b * 2 + 1] - points[a * 2 + 1];
		const length = Math.hypot(dx, dy) || 1;
		dx /= length;
		dy /= length;
		const f = i / (count - 1),
			half = width * 0.5 * (0.12 + 0.88 * Math.pow(f, 1.2)) * (1 - Math.pow(f, 12) * 0.35);
		left.push(points[i * 2] - dy * half, points[i * 2 + 1] + dx * half);
		right.push(points[i * 2] + dy * half, points[i * 2 + 1] - dx * half);
	}
	ctx.beginPath();
	ctx.moveTo(left[0], left[1]);
	for (let i = 2; i < left.length; i += 2) ctx.lineTo(left[i], left[i + 1]);
	for (let i = right.length - 2; i >= 0; i -= 2) ctx.lineTo(right[i], right[i + 1]);
	ctx.closePath();
	ctx.fill();
}

/** Trace bounded, seeded streamlines through an animated vector field, with depth of field, bloom, and tapered silk strands. @param ctx Paint context. @param size CSS-pixel dimensions. @param properties CSS inputs. */
export function paint(ctx: PaintContext, size: PaintSize, properties: PaintProperties): void {
	if (!drawable(size)) return;
	const { phase, hue, intensity, seed, viewX, viewY } = controls(properties),
		next = random(seed);
	const count = Math.floor(number(properties, "--flow-density", 550, 10, 1000));
	const turbulence = number(properties, "--flow-turbulence", 2.4, 0.1, 8);
	const length = Math.floor(number(properties, "--flow-length", 44, 4, 80));
	const vortex = number(properties, "--flow-vortex", 1, 0, 3);
	const scale = Math.min(size.width, size.height);
	const field = { width: size.width, height: size.height, scale, turbulence, vortex, phase, viewX, viewY };
	const streams: Stream[] = [];
	for (let line = 0; line < count; line++) {
		const x = next() * size.width,
			y = next() * size.height;
		const tint = hue + (x / size.width) * 95 + next() * 30;
		const light = next();
		const depth = 0.2 + next() * 0.8;
		// Far strands drift with the background; near strands slide further with the view.
		const parallax = (depth - 0.5) * scale * 0.06;
		streams.push({ points: trace(x + viewX * parallax, y + viewY * parallax, length, field), tint, depth, light });
	}
	ctx.save();
	ctx.globalCompositeOperation = "lighter";
	ctx.lineCap = "round";
	ctx.lineJoin = "round";
	const cx = size.width * (0.48 + viewX * 0.1),
		cy = size.height * (0.5 + viewY * 0.1);
	glow(ctx, cx, cy, scale * 0.8, `hsla(${hue + 25}, 85%, 40%, ${intensity * 0.12})`);
	glow(ctx, cx, cy, scale * 0.28, `hsla(${hue + 45}, 90%, 60%, ${intensity * 0.06 * Math.min(1, vortex)})`);

	// Out-of-focus strands share one blurred layer instead of one filter per line.
	ctx.beginPath();
	for (const stream of streams) if (stream.depth < 0.42) polyline(ctx, stream.points, Math.floor(length * 0.25));
	blur(ctx, 2.2);
	const haze = ctx.createLinearGradient(0, 0, size.width, 0);
	haze.addColorStop(0, `hsla(${hue + 10}, 80%, 58%, ${0.22 * intensity})`);
	haze.addColorStop(1, `hsla(${hue + 110}, 80%, 58%, ${0.22 * intensity})`);
	ctx.strokeStyle = haze;
	ctx.lineWidth = 1.6;
	ctx.stroke();

	// Bloom: the focused strands, wide and soft.
	for (let bucket = 0; bucket < BUCKETS; bucket++) {
		ctx.beginPath();
		let any = false;
		for (const stream of streams) {
			if (stream.depth < 0.42 || Math.min(BUCKETS - 1, Math.floor(((stream.tint - hue) / 125) * BUCKETS)) !== bucket) continue;
			polyline(ctx, stream.points, Math.floor(length * 0.45));
			any = true;
		}
		if (!any) continue;
		blur(ctx, scale * 0.009);
		ctx.strokeStyle = `hsla(${hue + (bucket + 0.5) * 62 + 10}, 95%, 60%, ${0.2 * intensity})`;
		ctx.lineWidth = 4;
		ctx.stroke();
	}
	blur(ctx, 0);

	// Sharp silk: tapered ribbons whose heads burn white-hot.
	for (const stream of streams) {
		if (stream.depth < 0.42) continue;
		const { points, tint, depth, light } = stream;
		const end = points.length - 2;
		const alpha = Math.min(1, (0.25 + depth * 0.75) * intensity);
		const gradient = ctx.createLinearGradient(points[0], points[1], points[end] + 0.01, points[end + 1] + 0.01);
		gradient.addColorStop(0, `hsla(${tint - 10}, 90%, 50%, 0)`);
		gradient.addColorStop(0.3, `hsla(${tint - 4}, 90%, 56%, ${alpha * 0.3})`);
		gradient.addColorStop(0.7, `hsla(${tint + 6}, 92%, 64%, ${alpha * 0.7})`);
		gradient.addColorStop(0.92, `hsla(${tint + 18}, 95%, ${72 + light * 10}%, ${alpha})`);
		gradient.addColorStop(1, `hsla(${tint + 30}, 100%, 94%, ${alpha})`);
		ctx.fillStyle = gradient;
		ribbon(ctx, points, 0.5 + depth * depth * 2.4);
	}

	// Sparks where the brightest strands end.
	for (const stream of streams) {
		if (stream.depth < 0.7 || stream.light < 0.88) continue;
		const end = stream.points.length - 2;
		glow(ctx, stream.points[end], stream.points[end + 1], 3 + stream.depth * 7, `hsla(${stream.tint + 30}, 100%, 85%, ${0.5 * intensity})`);
	}
	ctx.restore();
}
