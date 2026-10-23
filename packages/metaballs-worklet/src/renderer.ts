import { commonProperties, controls, drawable, glow, number, random, TAU } from "../../core/src/index.ts";
import { material, surface } from "../../core/src/surface.ts";
import { contourPath } from "./contours.ts";
import type { PaintContext, PaintProperties, PaintSize } from "../../core/src/types.ts";
export const inputProperties = [...commonProperties, "--metaballs-count", "--metaballs-size", "--metaballs-merging"];

/** Solve a three-dimensional implicit liquid surface and shade its analytic normals. @param ctx Paint context. @param size CSS dimensions. @param properties CSS inputs. */
export function paint(ctx: PaintContext, size: PaintSize, properties: PaintProperties): void {
	if (!drawable(size)) return;
	const { phase, hue, intensity, seed, viewX, viewY } = controls(properties),
		next = random(seed);
	const count = Math.floor(number(properties, "--metaballs-count", 5, 2, 9));
	const scale = Math.min(size.width, size.height),
		sizeFactor = number(properties, "--metaballs-size", 1, 0.5, 1.5);
	const merging = number(properties, "--metaballs-merging", 1, 0.6, 1.6);
	const balls: { x: number; y: number; radius: number }[] = [];
	let maxHeight = 0;
	for (let i = 0; i < count; i++) {
		const offset = next() * TAU,
			orbit = 0.13 + next() * 0.17;
		const radius = (0.065 + next() * 0.035) * sizeFactor;
		balls.push({ x: Math.cos(phase + offset) * orbit, y: Math.sin(phase * 2 + offset) * orbit * 0.8, radius: radius * radius });
		maxHeight += radius * radius;
	}
	maxHeight = Math.sqrt(maxHeight * merging);
	ctx.save();
	glow(ctx, size.width / 2, size.height * 0.55, scale * 0.6, `hsla(${hue + 30}, 90%, 45%, ${intensity * 0.15})`);
	const columns = 180,
		rows = 128,
		field = new Float32Array((columns + 1) * (rows + 1));
	for (let row = 1; row < rows; row++) {
		for (let column = 1; column < columns; column++) {
			const x = ((column / columns - 0.5) * size.width) / scale - viewX * 0.03,
				y = ((row / rows - 0.5) * size.height) / scale - viewY * 0.03;
			let value = 0;
			for (const ball of balls) value += ball.radius / Math.max(0.00001, (x - ball.x) ** 2 + (y - ball.y) ** 2);
			field[row * (columns + 1) + column] = value;
		}
	}
	contourPath(ctx, field, columns, rows, size.width, size.height, 1 / merging);
	ctx.clip("evenodd");
	const distances = new Float64Array(count);
	surface(
		ctx,
		size,
		function shade(u, v) {
			const x = ((u - 0.5) * size.width) / scale - viewX * 0.03,
				y = ((v - 0.5) * size.height) / scale - viewY * 0.03;
			let field = 0;
			for (let i = 0; i < count; i++) {
				const ball = balls[i];
				distances[i] = Math.max(0.00001, (x - ball.x) ** 2 + (y - ball.y) ** 2);
				field += ball.radius / distances[i];
			}
			if (field * merging < 0.8) return "transparent";
			let low = 0,
				high = maxHeight;
			for (let iteration = 0; iteration < 9; iteration++) {
				const z = (low + high) / 2;
				let density = 0;
				for (let i = 0; i < count; i++) density += balls[i].radius / (distances[i] + z * z);
				if (density * merging > 1) low = z;
				else high = z;
			}
			const z = (low + high) / 2;
			let nx = 0,
				ny = 0,
				nz = 0;
			for (let i = 0; i < count; i++) {
				const ball = balls[i],
					weight = ball.radius / (distances[i] + z * z) ** 2;
				nx += (x - ball.x) * weight;
				ny += (y - ball.y) * weight;
				nz += z * weight;
			}
			const length = Math.hypot(nx, ny, nz) || 1;
			return material(nx / length, ny / length, nz / length, hue, intensity, 1, -0.6 + viewX * 2, -0.7 + viewY * 2);
		},
		192,
	);
	ctx.restore();
}
