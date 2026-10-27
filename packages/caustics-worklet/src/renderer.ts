import { blur, commonProperties, controls, drawable, number, random, TAU, token } from "../../core/src/index.ts";
import { spectrum } from "../../core/src/surface.ts";
import type { PaintContext, PaintProperties, PaintSize } from "../../core/src/types.ts";
export const inputProperties = [...commonProperties, "--caustics-density", "--caustics-refraction", "--caustics-depth", "--caustics-floor"];

interface Wave {
	kx: number;
	ky: number;
	amplitude: number;
	speed: number;
	offset: number;
}

interface Mesh {
	columns: number;
	rows: number;
	cell: number;
	margin: number;
	unit: number;
	shiftX: number;
	shiftY: number;
}

/** Brightness classes on a logarithmic scale; quads are batched into one path per class. */
const LEVELS = 12;
/** Classes from which light is split into dispersed color channels. */
const DISPERSED = 5;
/** Surface wave components. */
const WAVES = 14;

/** Build a seeded spectrum of travelling surface waves whose slopes fold light into caustics. @param seed Variation seed. @returns Wave components. */
function waves(seed: number): Wave[] {
	const next = random(seed * 7 + 3),
		result: Wave[] = [];
	// Many components in a narrow wavelength band keep the folding statistics steady, so the seams stay a connected mesh all loop.
	for (let i = 0; i < WAVES; i++) {
		const angle = (i / WAVES) * Math.PI * 2 + next() * 0.45,
			k = 2.1 + next() * 1.1;
		result.push({
			kx: Math.cos(angle) * k,
			ky: Math.sin(angle) * k,
			amplitude: ((0.6 + next() * 0.4) / (k * k * 6)) * Math.sqrt(9 / WAVES),
			speed: (next() < 0.5 ? -1 : 1) * (2 + Math.floor(next() * 3)),
			offset: next() * TAU,
		});
	}
	return result;
}

/** Sample the water surface gradient. @param field Surface waves. @param x World x. @param y World y. @param t Loop phase. @param out Output gradient. @param index Output offset. */
function slope(field: Wave[], x: number, y: number, t: number, out: Float64Array, index = 0): void {
	let gx = 0,
		gy = 0;
	for (const wave of field) {
		const tilt = Math.cos(wave.kx * x + wave.ky * y + wave.speed * t + wave.offset) * wave.amplitude;
		gx += tilt * wave.kx;
		gy += tilt * wave.ky;
	}
	out[index] = gx;
	out[index + 1] = gy;
}

/** Bend every vertex of the light mesh along its refracted ray onto the floor. @param field Surface waves. @param mesh Mesh layout. @param t Loop phase. @param strength Refraction distance. @param out Mapped pixel coordinates. */
function project(field: Wave[], mesh: Mesh, t: number, strength: number, out: Float64Array): void {
	const { columns, rows, cell, margin, unit, shiftX, shiftY } = mesh;
	for (let row = 0, index = 0; row <= rows; row++) {
		for (let column = 0; column <= columns; column++, index += 2) {
			const x = (column * cell - margin + shiftX) / unit,
				y = (row * cell - margin + shiftY) / unit;
			slope(field, x, y, t, out, index);
			out[index] = (x - out[index] * strength) * unit - shiftX;
			out[index + 1] = (y - out[index + 1] * strength) * unit - shiftY;
		}
	}
}

/** Sort projected quads into logarithmic brightness classes by how strongly each one concentrates its light. @param mapped Projected vertices. @param mesh Mesh layout. @param size Surface size. @param first Lowest class kept. @param last Highest class kept. @returns Flat quad coordinates per class. */
function classify(mapped: Float64Array, mesh: Mesh, size: PaintSize, first: number, last: number): number[][] {
	const { columns, rows, cell } = mesh,
		area = cell * cell,
		stride = (columns + 1) * 2;
	const classes: number[][] = [];
	for (let level = 0; level < LEVELS; level++) classes.push([]);
	for (let row = 0; row < rows; row++) {
		for (let column = 0; column < columns; column++) {
			const a = row * stride + column * 2,
				b = a + 2,
				c = a + stride + 2,
				d = a + stride;
			const ax = mapped[a],
				ay = mapped[a + 1],
				bx = mapped[b],
				by = mapped[b + 1],
				cx = mapped[c],
				cy = mapped[c + 1],
				dx = mapped[d],
				dy = mapped[d + 1];
			if (Math.max(ax, bx, cx, dx) < 0 || Math.min(ax, bx, cx, dx) > size.width) continue;
			if (Math.max(ay, by, cy, dy) < 0 || Math.min(ay, by, cy, dy) > size.height) continue;
			const projected = Math.abs((cx - ax) * (dy - by) - (dx - bx) * (cy - ay)) * 0.5;
			const level = Math.min(LEVELS - 1, Math.floor(Math.log2(area / Math.max(area * 0.004, projected)) * 2));
			if (level >= first && level <= last) classes[level].push(ax, ay, bx, by, cx, cy, dx, dy);
		}
	}
	return classes;
}

/** Trace a batch of quads as one path. @param ctx Paint context. @param quads Flat quad coordinates. */
function trace(ctx: PaintContext, quads: number[]): void {
	ctx.beginPath();
	for (let i = 0; i < quads.length; i += 8) {
		ctx.moveTo(quads[i], quads[i + 1]);
		ctx.lineTo(quads[i + 2], quads[i + 3]);
		ctx.lineTo(quads[i + 4], quads[i + 5]);
		ctx.lineTo(quads[i + 6], quads[i + 7]);
		ctx.closePath();
	}
}

/** Paint sunlight focused by a moving water surface: refracted light-mesh caustics with dispersion, bloom, a refracted floor, and depth haze. @param ctx Paint context. @param size CSS dimensions. @param properties CSS inputs. */
export function paint(ctx: PaintContext, size: PaintSize, properties: PaintProperties): void {
	if (!drawable(size)) return;
	const { phase, hue, intensity, seed, viewX, viewY } = controls(properties);
	const density = number(properties, "--caustics-density", 24, 8, 42);
	const refraction = number(properties, "--caustics-refraction", 1, 0.1, 2);
	const depth = number(properties, "--caustics-depth", 0.7, 0, 1);
	const floor = token(properties, "--caustics-floor", "none");
	const { width, height } = size;
	const scale = Math.min(width, height);
	const unit = (scale / density) * 1.5;
	const field = waves(seed);
	const strength = 1.95 + refraction * 1.8;
	const t = phase;
	const fade = 0.22 + (1 - depth) * 0.6;
	ctx.save();

	// Water volume: lit from above, absorbing towards the far edge.
	const water = ctx.createLinearGradient(0, 0, width * 0.3, height);
	water.addColorStop(0, spectrum(hue - 6, 0.32 * intensity, 0.8));
	water.addColorStop(0.6, spectrum(hue - 2, 0.15 * intensity, 0.84));
	water.addColorStop(1, spectrum(hue + 4, (0.045 + (1 - depth) * 0.06) * intensity, 0.88));
	ctx.fillStyle = water;
	ctx.fillRect(0, 0, width, height);

	const margin = unit * strength * 0.5;
	// Resolve each wave cell finely enough to keep seams continuous, within a fixed quad budget.
	const cell = Math.max(Math.sqrt(((width + margin * 2) * (height + margin * 2)) / 7500), Math.min(unit * 0.27, 18));
	const mesh: Mesh = {
		columns: Math.min(400, Math.ceil((width + margin * 2) / cell)),
		rows: Math.min(400, Math.ceil((height + margin * 2) / cell)),
		cell,
		margin,
		unit,
		shiftX: viewX * unit * 0.8,
		shiftY: viewY * unit * 0.8,
	};
	const mapped = new Float64Array((mesh.columns + 1) * (mesh.rows + 1) * 2);

	// A refracted floor, seen through the same surface so the grout lines wobble with the light.
	if (floor === "tiles" || floor === "sand") {
		const tile = unit * (floor === "tiles" ? 1.15 : 0.42),
			bend = new Float64Array(2);
		ctx.strokeStyle = spectrum(hue + 12, 0.02 * intensity, 0.7, floor === "tiles" ? 0.3 : 0.14);
		ctx.lineWidth = Math.max(1, unit * (floor === "tiles" ? 0.055 : 0.03));
		ctx.beginPath();
		for (let axis = 0; axis < 2; axis++) {
			const span = axis ? height : width,
				other = axis ? width : height,
				steps = Math.ceil(other / 12);
			for (let line = -1; line <= span / tile + 1; line++) {
				for (let step = 0; step <= steps; step++) {
					const along = (step / steps) * other,
						across = line * tile + (axis ? mesh.shiftY : mesh.shiftX) * 0.3;
					const px = axis ? along : across,
						py = axis ? across : along;
					slope(field, px / unit, py / unit, t, bend);
					const x = px + bend[0] * unit * 0.35,
						y = py + bend[1] * unit * 0.35;
					if (step) ctx.lineTo(x, y);
					else ctx.moveTo(x, y);
				}
			}
		}
		ctx.stroke();
	}

	// Light mesh: each source quad keeps its energy, so compressed quads glow and folded sheets overlap into bright seams.
	const tint = (spectrum(hue - 12, 2, 0.4).match(/[\d.]+/g) || ["255", "255", "255"]).slice(0, 3).map(Number);
	ctx.globalCompositeOperation = "lighter";
	/** Light carried by a brightness class. @param level Class index. @returns Linear light fraction. */
	function energy(level: number): number {
		return Math.min(1, 0.22 * Math.pow(2, (level + 0.5) * 0.45) * intensity);
	}
	project(field, mesh, t, strength, mapped);
	const soft = classify(mapped, mesh, size, 1, DISPERSED - 1);
	// The faintest class shares the next layer, keeping weak links in the network without another blur pass.
	soft[2] = soft[2].concat(soft[1]);
	for (let level = 2; level < DISPERSED; level++) {
		if (!soft[level].length) continue;
		const light = energy(level) * (level === 2 ? 0.85 : 1) - 0.22 * intensity;
		const shade = ctx.createLinearGradient(0, 0, 0, height);
		shade.addColorStop(0, `rgba(${tint.join(",")},${light})`);
		shade.addColorStop(1, `rgba(${tint.join(",")},${light * fade})`);
		ctx.save();
		blur(ctx, cell * (level >= DISPERSED - 2 ? 0.3 : 0.6 + (DISPERSED - level) * 0.15));
		ctx.fillStyle = shade;
		trace(ctx, soft[level]);
		ctx.fill();
		ctx.restore();
	}
	const bright: number[][] = [soft[DISPERSED - 1]];
	for (let channel = 0; channel < 3; channel++) {
		if (channel !== 1) project(field, mesh, t, strength * (1 + (channel - 1) * 0.026), mapped);
		const sharp = classify(mapped, mesh, size, DISPERSED, LEVELS - 1);
		for (let level = DISPERSED; level < LEVELS; level++) {
			if (!sharp[level].length) continue;
			const light = (energy(level) - 0.22 * intensity) * (tint[channel] / 255);
			const rgb = [0, 0, 0];
			rgb[channel] = 255;
			const shade = ctx.createLinearGradient(0, 0, 0, height);
			shade.addColorStop(0, `rgba(${rgb.join(",")},${Math.min(1, light)})`);
			shade.addColorStop(1, `rgba(${rgb.join(",")},${Math.min(1, light * fade)})`);
			ctx.fillStyle = shade;
			trace(ctx, sharp[level]);
			ctx.fill();
			if (channel === 1) bright.push(sharp[level]);
		}
	}

	// Bloom: a tight glow that fuses the seams into continuous bands, and a wide veil around them.
	for (const [radius, alpha, batches] of [
		[cell * 0.55, 0.75, bright],
		[scale * 0.025, 0.45, bright],
	] as [number, number, number[][]][]) {
		ctx.save();
		blur(ctx, radius);
		const veil = ctx.createLinearGradient(0, 0, 0, height);
		veil.addColorStop(0, spectrum(hue - 15, 0.6 * intensity, 0.5, alpha));
		veil.addColorStop(1, spectrum(hue - 15, 0.6 * intensity, 0.5, alpha * fade));
		ctx.fillStyle = veil;
		ctx.beginPath();
		for (const quads of batches) {
			for (let i = 0; i < quads.length; i += 8) {
				ctx.moveTo(quads[i], quads[i + 1]);
				ctx.lineTo(quads[i + 2], quads[i + 3]);
				ctx.lineTo(quads[i + 4], quads[i + 5]);
				ctx.lineTo(quads[i + 6], quads[i + 7]);
				ctx.closePath();
			}
		}
		ctx.fill();
		ctx.restore();
	}

	// Sun shafts slanting through the water column, blurred together as one layer.
	ctx.save();
	blur(ctx, scale * 0.04);
	const next = random(seed + 11);
	const shaft = ctx.createLinearGradient(0, 0, 0, height);
	shaft.addColorStop(0, spectrum(hue - 20, 0.16 * intensity, 0.4, 0.5));
	shaft.addColorStop(1, "rgba(0,0,0,0)");
	ctx.fillStyle = shaft;
	ctx.beginPath();
	for (let ray = 0; ray < 5; ray++) {
		const x = (next() * 1.4 - 0.25 + Math.sin(t + ray * 1.7) * 0.03 + viewX * 0.05) * width,
			spread = (0.015 + next() * 0.05) * width;
		ctx.moveTo(x - spread * 0.4, -10);
		ctx.lineTo(x + spread * 0.4, -10);
		ctx.lineTo(x + spread + height * 0.35, height);
		ctx.lineTo(x - spread + height * 0.35, height);
		ctx.closePath();
	}
	ctx.fill();
	ctx.restore();
	ctx.restore();
}
