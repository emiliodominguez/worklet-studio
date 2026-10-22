import { commonProperties, controls, drawable, glow, number, random } from "../../core/src/index.ts";
import type { PaintContext, PaintProperties, PaintSize } from "../../core/src/types.ts";
export const inputProperties = [...commonProperties, "--caustics-density", "--caustics-refraction", "--caustics-depth"];

interface Point {
	x: number;
	y: number;
}

/** Clip a light cell against a neighboring focus. @param polygon Cell vertices. @param site Cell focus. @param other Neighbor focus. @returns Clipped vertices. */
function clipCell(polygon: Point[], site: Point, other: Point): Point[] {
	const nx = other.x - site.x,
		ny = other.y - site.y;
	const offset = (other.x ** 2 + other.y ** 2 - site.x ** 2 - site.y ** 2) / 2;
	const result: Point[] = [];
	for (let i = 0; i < polygon.length; i++) {
		const a = polygon[i],
			b = polygon[(i + 1) % polygon.length];
		const da = a.x * nx + a.y * ny - offset,
			db = b.x * nx + b.y * ny - offset;
		if (da <= 0) result.push(a);
		if (da <= 0 !== db <= 0) {
			const t = da / (da - db);
			result.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
		}
	}
	return result;
}

/** Paint continuously curved, refracted light cells without raster sampling. @param ctx Paint context. @param size CSS dimensions. @param properties CSS inputs. */
export function paint(ctx: PaintContext, size: PaintSize, properties: PaintProperties): void {
	if (!drawable(size)) return;
	const { phase, hue, intensity, seed } = controls(properties);
	const density = number(properties, "--caustics-density", 24, 8, 42);
	const refraction = number(properties, "--caustics-refraction", 1, 0.1, 2);
	const depth = number(properties, "--caustics-depth", 0.7, 0, 1);
	const scale = Math.min(size.width, size.height),
		frequency = density / 3;
	const width = Math.min(4, size.width / scale) * frequency,
		height = Math.min(4, size.height / scale) * frequency;
	const water = ctx.createLinearGradient(0, 0, size.width, size.height);
	water.addColorStop(0, `hsl(${hue - 12}, 70%, ${10 + depth * 8}%)`);
	water.addColorStop(1, `hsl(${hue + 20}, 80%, ${3 + depth * 4}%)`);
	ctx.fillStyle = water;
	ctx.fillRect(0, 0, size.width, size.height);
	const columns = Math.ceil(width) + 6,
		rows = Math.ceil(height) + 6;
	const sites: Point[] = [];
	for (let y = 0; y < rows; y++) {
		for (let x = 0; x < columns; x++) {
			const next = random(seed + x * 937 + y * 6271);
			sites.push({ x: x - 3 + 0.1 + next() * 0.8, y: y - 3 + 0.1 + next() * 0.8 });
		}
	}
	ctx.save();
	ctx.globalCompositeOperation = "lighter";
	ctx.lineCap = "round";
	ctx.lineJoin = "round";
	glow(ctx, size.width * 0.25, size.height * 0.2, scale * 0.9, `hsla(${hue - 25}, 80%, 65%, ${0.18 * intensity})`);
	for (let row = 2; row < rows - 2; row++) {
		for (let column = 2; column < columns - 2; column++) {
			const site = sites[row * columns + column];
			let cell: Point[] = [
				{ x: site.x - 2, y: site.y - 2 },
				{ x: site.x + 2, y: site.y - 2 },
				{ x: site.x + 2, y: site.y + 2 },
				{ x: site.x - 2, y: site.y + 2 },
			];
			for (let dy = -2; dy <= 2; dy++) {
				for (let dx = -2; dx <= 2; dx++) {
					if (dx || dy) cell = clipCell(cell, site, sites[(row + dy) * columns + column + dx]);
				}
			}
			if (cell.length < 3) continue;
			const points: Point[] = [];
			for (let i = 0; i < cell.length; i++) {
				const a = cell[i],
					b = cell[(i + 1) % cell.length];
				// Mid-edge samples keep the light ribbons curved as waves pass across a cell.
				for (let step = 0; step < 2; step++) {
					const x = a.x + ((b.x - a.x) * step) / 2,
						y = a.y + ((b.y - a.y) * step) / 2;
					points.push({
						x: ((x + (Math.sin(y * 1.8 + phase) + Math.cos(x * 1.2 - phase)) * 0.25 * refraction) / width) * size.width,
						y: ((y + (Math.cos(x * 1.6 - phase) + Math.sin(y * 1.3 + phase)) * 0.25 * refraction) / height) * size.height,
					});
				}
			}
			const first = points[0],
				last = points[points.length - 1];
			ctx.beginPath();
			ctx.moveTo((last.x + first.x) / 2, (last.y + first.y) / 2);
			for (let i = 0; i < points.length; i++) {
				const point = points[i],
					next = points[(i + 1) % points.length];
				ctx.quadraticCurveTo(point.x, point.y, (point.x + next.x) / 2, (point.y + next.y) / 2);
			}
			ctx.closePath();
			const focus = 0.4 + 0.6 * Math.pow((Math.sin(site.x * 2 + site.y + phase) + 1) / 2, 2);
			ctx.strokeStyle = `hsla(${hue - 20}, 90%, 65%, ${0.025 * intensity * focus})`;
			ctx.lineWidth = 12;
			ctx.stroke();
			ctx.strokeStyle = `hsla(${hue - 15}, 85%, 75%, ${0.1 * intensity * focus})`;
			ctx.lineWidth = 4;
			ctx.stroke();
			ctx.strokeStyle = `hsla(${hue - 5}, 80%, 86%, ${0.5 * intensity * focus})`;
			ctx.lineWidth = 0.8;
			ctx.stroke();
		}
	}
	ctx.restore();
}
