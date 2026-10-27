import { commonProperties, controls, drawable, number, token } from "../../core/src/index.ts";
import { noised, slope } from "./noise.ts";
import { adaptiveSurface } from "./sampler.ts";
import { isolines } from "./contours.ts";
import type { PaintContext, PaintSize, PaintProperties } from "../../core/src/types.ts";
export const inputProperties = [
	...commonProperties,
	"--iridescence-scale",
	"--iridescence-ridges",
	"--iridescence-shimmer",
	"--iridescence-metallic",
	"--iridescence-position-x",
	"--iridescence-position-y",
	"--iridescence-film",
];

/** Two sample wavelengths (nm) per display channel; averaging them lets high interference orders wash out to pastel like real films. */
const WAVELENGTHS = [
	[610, 680],
	[515, 560],
	[440, 475],
];

/** Peak sensitivity (nm) of each display channel for diffracted light. */
const CENTERS = [612, 545, 465];

/** Creamy nacre albedo per channel. */
const CREAM = [1, 0.96, 0.91];

/** Refractive index of each coating. */
const INDEX: Record<string, number> = { foil: 1.38, pearl: 1.53, oil: 1.45 };

/** Gradient of the most recent `drain` call, in sheet units. */
const drift = { x: 0, y: 0 };

/** Smooth Hermite step. @param edge0 Lower edge. @param edge1 Upper edge. @param x Input. @returns 0–1. */
function smoothstep(edge0: number, edge1: number, x: number): number {
	const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
	return t * t * (3 - 2 * t);
}

/** Map linear light to a display level with a soft shoulder. @param value Linear light. @returns 0–1. */
function display(value: number): number {
	return 1 - Math.exp(-Math.max(0, value) * 1.35);
}

/** Interference reflectance at one wavelength, with fringes finer than a sample averaged away. @param path Optical path difference (nm). @param footprint Path change across one sample (nm). @param wavelength Wavelength (nm). @returns 0–1. */
function fringe(path: number, footprint: number, wavelength: number): number {
	const ratio = footprint / wavelength;
	return 0.5 - 0.5 * Math.cos((6.2832 * path) / wavelength) * Math.exp(-1.645 * ratio * ratio);
}

/** Swirled drainage of a thin film: domain-warped noise and its analytic gradient (written to `drift`). @param x Sheet x. @param y Sheet y. @param t Loop phase. @param scale Swirl frequency. @param seed Variation seed. @returns Flow in about [-1, 1]. */
function drain(x: number, y: number, t: number, scale: number, seed: number): number {
	const X = x * scale + Math.sin(t + y * 0.4) * 0.6,
		Y = y * scale + Math.cos(t - x * 0.3) * 0.6;
	const Xy = 0.24 * Math.cos(t + y * 0.4),
		Yx = 0.18 * Math.sin(t - x * 0.3);
	const warp = noised(X * 0.7, Y * 0.7, seed);
	const AX = 1 + 0.77 * slope.x,
		AY = 0.77 * slope.y;
	const A = X + warp * 1.1;
	const coarse = noised(A, Y, seed + 9);
	let dA = slope.x * 0.68,
		dB = slope.y * 0.68;
	const fine = noised(A * 2.03 + 13.7, Y * 2.03 + 9.2, seed + 26);
	dA += slope.x * 0.65;
	dB += slope.y * 0.65;
	const dX = dA * AX,
		dY = dA * AY + dB;
	drift.x = dX * scale + dY * Yx;
	drift.y = dX * Xy + dY * scale;
	return coarse * 0.68 + fine * 0.32;
}

/** Paint a thin film over a folded sheet: per-wavelength interference, a studio reflection, and fine structure, all pre-filtered to the sample grid. Films: foil (holographic grating), pearl (nacre terraces), or oil (slick on dark water). @param ctx Paint context. @param size CSS dimensions. @param properties CSS inputs. */
export function paint(ctx: PaintContext, size: PaintSize, properties: PaintProperties): void {
	if (!drawable(size)) return;
	const { phase, hue, intensity, seed, viewX, viewY } = controls(properties);
	const frequency = number(properties, "--iridescence-scale", 2.4, 0.3, 8);
	const ridges = number(properties, "--iridescence-ridges", 0.55, 0, 1);
	const shimmer = number(properties, "--iridescence-shimmer", 0.65, 0, 1);
	const metallic = number(properties, "--iridescence-metallic", 0.65, 0, 1);
	const px = number(properties, "--iridescence-position-x", 0.5, 0, 1) - 0.5 + viewX;
	const py = number(properties, "--iridescence-position-y", 0.5, 0, 1) - 0.5 + viewY;
	const requested = token(properties, "--iridescence-film", "foil");
	const kind = requested in INDEX ? requested : "foil";
	const index = INDEX[kind];
	const oil = kind === "oil",
		pearl = kind === "pearl";
	const t = phase + seed * 0.019;
	const shortest = Math.min(size.width, size.height);
	const sheet = frequency * 2.2;
	const aspect = size.width / shortest,
		tall = size.height / shortest;
	// The hue picks where in the interference sequence the thinnest film starts.
	const base = (pearl ? 200 : 180) + ((((hue % 360) + 360) % 360) / 360) * 420;
	const swing = (oil ? 260 : pearl ? 120 : 110) + shimmer * (oil ? 420 : pearl ? 220 : 170);
	const lx = -0.35 + px * 1.2,
		ly = -0.45 + py * 1.2,
		reachL = Math.sqrt(lx * lx + ly * ly) || 1;
	const sinT = Math.sin(t),
		cosT = Math.cos(t),
		fold = oil ? 0.25 : 1;
	const swirlScale = 0.55 * (oil ? Math.min(1, 2.6 / frequency) : 1);
	const columns = Math.max(24, Math.min(84, Math.ceil(size.width / 12))),
		rows = Math.max(24, Math.min(170, Math.ceil(size.height / 3.6)));
	// Sheet distance covered by one refined sample: the filter width for every pre-filtered detail.
	// Sheet distance between samples: coarse columns horizontally (faint detail is never refined), rows vertically. Every pre-filter uses this footprint.
	const spacingX = ((size.width / columns) * 0.75 * sheet) / shortest,
		spacingY = ((size.height / rows) * 1.15 * sheet) / shortest,
		spacing = (spacingX + spacingY) / 2;
	const steps = 5 + ridges * 7;
	const rgb = [0, 0, 0],
		film = [0, 0, 0];
	const sample = { color: "", r: 0, g: 0, b: 0 };
	ctx.save();
	adaptiveSurface(
		ctx,
		size,
		function shade(u, v) {
			const x = (u - 0.5) * aspect * sheet,
				y = (v - 0.5) * tall * sheet;
			// Folded sheet: analytic height, slope, and a bound on curvature.
			const across = y * 0.8 + sinT,
				along = x * 0.65 - cosT;
			const a = x + Math.sin(across) * 1.7,
				b = y + Math.cos(along) * 1.6;
			const sinA = Math.sin(a),
				cosA = Math.cos(a),
				sinB = Math.sin(b),
				cosB = Math.cos(b);
			const hx = cosA + sinB * Math.sin(along) * 1.04,
				hy = cosA * Math.cos(across) * 1.36 - sinB;
			const height = sinA + cosB;
			const curvature = (Math.abs(sinA) + Math.abs(cosB)) * 1.6 + 0.3;
			const flow = drain(x, y, t, swirlScale, seed);
			const fx = drift.x,
				fy = drift.y;
			// Film thickness and its gradient: drainage, fold, and fine ridges.
			const flowWeight = oil ? 1.6 : 0.6,
				heightWeight = oil ? 0.15 : 0.35;
			let thickness = base + swing * (flow * flowWeight + height * heightWeight);
			let tx = swing * (fx * flowWeight + hx * heightWeight),
				ty = swing * (fy * flowWeight + hy * heightWeight);
			if (!pearl) {
				const argument = height * 5 + y * 2 + flow * 3,
					amount = 0.6 * ridges * 45;
				thickness += Math.sin(argument) * amount;
				const turn = Math.cos(argument) * amount;
				tx += turn * (5 * hx + 3 * fx);
				ty += turn * (5 * hy + 2 + 3 * fy);
			}
			if (pearl) {
				// Each platelet terrace grows a slightly different thickness, so color shifts band by band; faded where terraces are finer than a sample.
				const position = (flow * 1.3 + height * 0.22 + x * 0.08) * steps;
				const gx = (fx * 1.3 + hx * 0.22 + 0.08) * steps,
					gy = (fy * 1.3 + hy * 0.22) * steps;
				const change = Math.sqrt((gx * spacingX) ** 2 + (gy * spacingY) ** 2);
				const visible = Math.exp(-change * change * 2);
				const terrace = Math.sin(position * 6.2832) * 28 * visible * ridges;
				thickness += terrace;
				const turn = Math.cos(position * 6.2832) * 6.2832 * 28 * visible * ridges;
				tx += turn * gx;
				ty += turn * gy;
			}
			thickness = Math.max(0, thickness);
			const length = Math.sqrt((hx * hx + hy * hy) * fold * fold * 0.1225 + 1),
				nx = (-hx * fold * 0.35) / length,
				ny = (-hy * fold * 0.35) / length,
				nz = 1 / length;
			// Reflected ray from a camera straight above, and how far it swings across one sample.
			const rx = 2 * nz * nx,
				ry = 2 * nz * ny;
			const swingRay = 0.7 * fold * curvature * spacing;
			const boxWidth = pearl ? 0.16 : 0.42,
				boxHeight = pearl ? 0.1 : 0.28;
			const bx = (rx - lx) / boxWidth,
				by = (ry - ly) / boxHeight;
			const blurBox = swingRay / boxHeight;
			const softbox =
				smoothstep(1.3 + blurBox, Math.max(0, 0.55 - blurBox), Math.sqrt(Math.sqrt(bx * bx * bx * bx + by * by * by * by))) /
				(1 + blurBox * blurBox * 0.5);
			const spotWidth = 1 / 60 + swingRay * swingRay;
			const spot = (Math.exp(-((rx - lx) ** 2 + (ry - ly) ** 2) / spotWidth) / (spotWidth * 60)) * (pearl ? 0.5 : 1);
			const dome = 0.32 + 0.3 * smoothstep(-0.6 - swingRay, 0.6 + swingRay, -(rx * lx + ry * ly) / reachL);
			const environment = dome + softbox * (0.9 + metallic * 1.4);
			const fresnel = 0.55 + 0.45 * (1 - nz) * (1 - nz);
			// Optical path through the film, shorter when viewed obliquely, and how much it changes across one sample.
			const oblique = Math.sqrt(1 - (1 - nz * nz) / (index * index));
			const path = 2 * index * thickness * oblique;
			const footprint = 2 * index * Math.sqrt((tx * spacingX) ** 2 + (ty * spacingY) ** 2);
			for (let channel = 0; channel < 3; channel++) {
				const [first, second] = WAVELENGTHS[channel];
				film[channel] = (fringe(path, footprint, first) + fringe(path, footprint, second)) / 2;
			}
			if (pearl) {
				// Nacre: a creamy body under a pastel film; the platelet growth lines are drawn afterwards as vector contours.
				const diffuse = 0.95 + 0.5 * nz * nz * nz * nz + 0.35 * dome;
				// Satin lustre: a broad lobe rather than a mirror image of the softbox.
				const gloss = Math.exp(-((rx - lx) ** 2 + (ry - ly) ** 2) * 5) * (0.3 + metallic * 0.35);
				const sheen = 0.44 + 0.5 * (1 - nz);
				for (let channel = 0; channel < 3; channel++)
					rgb[channel] =
						(CREAM[channel] * diffuse * (1 - sheen) +
							film[channel] * (0.5 + gloss * 0.4) * sheen * 1.5 +
							gloss * 0.75 +
							spot * metallic) *
						intensity;
			} else {
				// Holographic foil: an embossed grating splits the key light into a first-order rainbow; two grating directions blend in patches.
				let rainbow = 0,
					wavelength = 0,
					bandwidth = 48;
				if (!oil) {
					const p = x * 0.9 + flow * 1.5,
						q = y * 1.0 - flow * 1.0;
					const sinP = Math.sin(p),
						sinQ = Math.sin(q),
						patch = sinP * sinQ;
					const blend = smoothstep(-0.7, 0.7, patch);
					// Gradient of the blend, so fast switches between grating directions widen the filter.
					const ramp = Math.max(0, Math.min(1, (patch + 0.7) / 1.4)),
						rate = (6 * ramp * (1 - ramp)) / 1.4;
					const cosP = Math.cos(p),
						cosQ = Math.cos(q);
					const blendX = rate * (cosP * (0.9 + 1.5 * fx) * sinQ - sinP * cosQ * fx),
						blendY = rate * (cosP * 1.5 * fy * sinQ + sinP * cosQ * (1 - fy));
					const gx = 0.83 * blend - 0.31 * (1 - blend),
						gy = 0.55 * blend + 0.95 * (1 - blend);
					const reach = Math.sqrt(gx * gx + gy * gy);
					const emboss = height * 9 + flow * 7,
						relief = Math.cos(emboss) * 0.05 * ridges;
					const offset = ((rx - lx) * gx + (ry - ly) * gy) / reach + Math.sin(emboss) * 0.05 * ridges;
					const sideways = ((rx - lx) * -gy + (ry - ly) * gx) / reach;
					wavelength = 380 + ((Math.abs(offset) * 1400) % 760);
					// How far the diffracted wavelength moves across one sample, from the turning ray and the fine embossing.
					const lever = Math.sqrt((rx - lx) ** 2 + (ry - ly) ** 2) * 1.21;
					const shiftX = relief * (9 * hx + 7 * fx) + lever * blendX,
						shiftY = relief * (9 * hy + 7 * fy) + lever * blendY;
					const smear = 1400 * (swingRay + Math.sqrt((shiftX * spacingX) ** 2 + (shiftY * spacingY) ** 2)) * 0.7;
					bandwidth = Math.sqrt(48 * 48 + smear * smear);
					// Fade near the ends of the visible range so the wavelength wrap never shows as a seam.
					const ends = smoothstep(380, 440, wavelength) * smoothstep(1140, 1060, wavelength);
					rainbow = (ridges * Math.exp(-sideways * sideways * 3.5) * smoothstep(0.02, 0.12, Math.abs(offset)) * ends * 48) / bandwidth;
				}
				for (let channel = 0; channel < 3; channel++) {
					const coating = film[channel] * environment * fresnel * (oil ? 0.72 : 1.25);
					const band = (wavelength - CENTERS[channel]) / bandwidth;
					const grating = rainbow > 0.002 && band * band < 9 ? rainbow * Math.exp(-band * band) * 2.2 : 0;
					rgb[channel] = (coating * (1 - rainbow * 0.5) + grating + spot * metallic * 2.4) * intensity;
				}
				if (oil) {
					const water = 0.012 + softbox * 0.03;
					rgb[0] += water * 0.6;
					rgb[1] += water * 0.8;
					rgb[2] += water;
				}
			}
			sample.r = display(rgb[0]);
			sample.g = display(rgb[1]);
			sample.b = display(rgb[2]);
			sample.color = `rgb(${Math.round(sample.r * 255)},${Math.round(sample.g * 255)},${Math.round(sample.b * 255)})`;
			return sample;
		},
		columns,
		rows,
		0.08,
	);
	if (pearl) {
		// Platelet terraces: iso-lines of the same drainage that colors the film, embossed as a shadow and a lit edge.
		const cell = Math.max(5, Math.sqrt((size.width * size.height) / 14000));
		const across = Math.ceil(size.width / cell),
			down = Math.ceil(size.height / cell);
		const field = new Float64Array((across + 1) * (down + 1));
		for (let row = 0; row <= down; row++) {
			for (let column = 0; column <= across; column++) {
				const x = ((column * cell) / size.width - 0.5) * aspect * sheet,
					y = ((row * cell) / size.height - 0.5) * tall * sheet;
				const a = x + Math.sin(y * 0.8 + sinT) * 1.7,
					b = y + Math.cos(x * 0.65 - cosT) * 1.6;
				field[row * (across + 1) + column] = (drain(x, y, t, swirlScale, seed) * 1.3 + (Math.sin(a) + Math.cos(b)) * 0.22 + x * 0.08) * steps;
			}
		}
		ctx.lineCap = "round";
		// Fine growth lines between the terraces.
		const fine = field.map(function finer(value) {
			return value * 3;
		});
		ctx.lineWidth = Math.max(0.5, cell * 0.08);
		ctx.beginPath();
		isolines(ctx, fine, across, down, cell, cell, 1.6, 60000);
		ctx.strokeStyle = `rgba(110, 86, 84, ${0.14 * ridges})`;
		ctx.stroke();
		ctx.lineWidth = Math.max(0.7, cell * 0.14);
		ctx.beginPath();
		isolines(ctx, field, across, down, cell, cell, 2.2, 60000);
		ctx.strokeStyle = `rgba(96, 72, 70, ${0.32 * ridges})`;
		ctx.stroke();
		ctx.translate(0.6, 0.9);
		ctx.strokeStyle = `rgba(255, 252, 246, ${0.4 * ridges * Math.min(1, intensity)})`;
		ctx.stroke();
	}
	ctx.restore();
}
