import { commonProperties, controls, drawable, number, TAU } from "../../core/src/index.ts";
import { spectrum } from "../../core/src/surface.ts";
import { adaptiveSurface } from "./sampler.ts";
import type { PaintContext, PaintSize, PaintProperties } from "../../core/src/types.ts";
export const inputProperties = [
	...commonProperties,
	"--ripple-rings",
	"--ripple-distortion",
	"--ripple-sources",
	"--ripple-position-x",
	"--ripple-position-y",
	"--ripple-metal",
];

/** Smooth Hermite step. @param edge0 Lower edge. @param edge1 Upper edge. @param x Input. @returns 0–1. */
function smoothstep(edge0: number, edge1: number, x: number): number {
	const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
	return t * t * (3 - 2 * t);
}

/** Studio light found along the last reflected ray: total radiance and the share that is white key light. */
const found = { radiance: 0, key: 0 };

/** Radiance of a dark photo studio seen along a reflected ray: a graded backdrop, an off-axis softbox, and a strip light. Each light is pre-filtered by the ray footprint, so highlights never get sharper than the sample grid can carry. Writes to `found`. @param rx Reflected x. @param ry Reflected y. @param rz Reflected z (up). @param lx Softbox x. @param ly Softbox y. @param metal Metal amount; metals see a larger, flat-topped softbox. @param footprint Spread of reflected directions across one sample. */
function studio(rx: number, ry: number, rz: number, lx: number, ly: number, metal: number, footprint: number): void {
	const reach = Math.sqrt(lx * lx + ly * ly) || 1;
	const toward = smoothstep(-0.3 - footprint, 0.6 + footprint, (rx * lx + ry * ly) / reach);
	const up = Math.max(0, rz);
	const backdrop = 0.025 + 0.42 * toward * toward + 0.05 * up * up * up * up;
	const extent = 0.55 + metal * 0.45;
	const bx = (rx - lx) / (0.26 * extent),
		by = (ry - ly) / (0.15 * extent);
	const shape = Math.sqrt(bx * bx * bx * bx + by * by * by * by);
	// Footprint in softbox units along its narrow axis.
	const spread = footprint / (0.15 * extent),
		spread2 = spread * spread;
	let box = 0;
	if (metal > 0) {
		const edge = Math.sqrt(shape);
		box += (smoothstep(1.45 + spread * 1.6, Math.max(0, 0.6 - spread * 1.6), edge) * metal) / (1 + spread2 * 0.6);
	}
	if (metal < 1) {
		const narrow = 1 / (1 + 3.2 * spread2);
		box += Math.exp(-shape * 1.6 * narrow) * narrow * (1 - metal) * 0.7;
	}
	const width = Math.sqrt(0.0036 + 2 * footprint * footprint);
	const sx = (rx + lx * 0.6 - 0.5) / width;
	const strip = sx * sx < 12 ? Math.exp(-sx * sx) * (0.06 / width) * smoothstep(0.8 + footprint, 0.3 - footprint, Math.abs(ry + 0.05)) : 0;
	const key = box * (3 + (1 - metal) * 4) + strip * 1.2;
	found.radiance = backdrop + key;
	found.key = Math.min(1, key);
}

/** Paint a liquid surface: spreading, interfering wavefronts that reflect a photo studio, from clear water to liquid metal. @param ctx Paint context. @param size CSS dimensions. @param properties CSS inputs. */
export function paint(ctx: PaintContext, size: PaintSize, properties: PaintProperties): void {
	if (!drawable(size)) return;
	const { phase, hue, intensity, seed, viewX, viewY } = controls(properties);
	const rings = Math.floor(number(properties, "--ripple-rings", 50, 4, 90));
	const distortion = number(properties, "--ripple-distortion", 0.45, 0, 1.5);
	const sources = Math.floor(number(properties, "--ripple-sources", 2, 1, 4));
	const metal = number(properties, "--ripple-metal", 0.15, 0, 1);
	const scale = Math.min(size.width, size.height);
	const px = number(properties, "--ripple-position-x", size.width / 2, -size.width, size.width * 2) / scale;
	const py = number(properties, "--ripple-position-y", size.height / 2, -size.height, size.height * 2) / scale;
	const centers: { x: number; y: number }[] = [];
	for (let source = 0; source < sources; source++) {
		const angle = (source / sources) * TAU + seed * 0.01;
		centers.push({ x: px + Math.cos(angle + Math.sin(phase) * 0.25) * (sources > 1 ? 0.2 : 0), y: py + Math.sin(angle) * 0.15 });
	}
	const wavenumber = rings * 0.65,
		amplitude = 0.42;
	const lx = -0.2 + viewX * 0.8,
		ly = -0.3 + viewY * 0.8;
	const reflectance = 0.1 + metal * 0.8;
	const middleX = size.width / scale / 2,
		middleY = size.height / scale / 2;
	// Coarse columns are bisected near highlights; rows stay dense so diagonal edges do not step between scanlines.
	// Each extra source costs a full wave evaluation per sample, so the grid shrinks to keep the frame budget.
	const budget = Math.sqrt(2 / Math.max(2, sources));
	const columns = Math.max(24, Math.min(Math.floor(100 * budget), Math.ceil(size.width / 10))),
		rows = Math.max(24, Math.min(Math.floor(200 * budget), Math.ceil(size.height / 3.1)));
	const spacing = Math.max(size.width / columns / 4, size.height / rows) / scale;
	ctx.save();
	const sample = { color: "", level: 0 };
	adaptiveSurface(
		ctx,
		size,
		function shade(u, v) {
			const x = (u * size.width) / scale,
				y = (v * size.height) / scale;
			let gx = 0,
				gy = 0,
				height = 0,
				curvature = 0;
			for (const center of centers) {
				const ox = x - center.x,
					oy = y - center.y,
					distance = Math.sqrt(ox * ox + oy * oy) + 0.001;
				const swell = ox * 8 + phase;
				const wave = distance * wavenumber - phase * 4 + Math.sin(swell) * distortion;
				const spread = Math.exp(-distance * 0.55) / Math.sqrt(1 + distance * 3);
				const crest = Math.cos(wave),
					slope = crest * spread * amplitude;
				gx += (slope * ox) / distance + crest * Math.cos(swell) * distortion * spread * 0.02;
				gy += (slope * oy) / distance;
				const rise = Math.sin(wave);
				height += rise * spread;
				curvature += wavenumber * spread * amplitude * (0.35 + 0.65 * Math.abs(rise));
			}
			// A camera slightly above the surface: rays fan out across the frame.
			let vx = -(x - middleX) * 0.32,
				vy = -(y - middleY) * 0.32 - 0.12,
				vz = 1;
			const view = Math.sqrt(vx * vx + vy * vy + vz * vz);
			vx /= view;
			vy /= view;
			vz /= view;
			const normal = Math.sqrt(gx * gx + gy * gy + 1),
				nx = -gx / normal,
				ny = -gy / normal,
				nz = 1 / normal;
			const facing = nx * vx + ny * vy + nz * vz;
			const rx = 2 * facing * nx - vx,
				ry = 2 * facing * ny - vy,
				rz = 2 * facing * nz - vz;
			// Reflected rays turn twice as fast as the normal; one sample spans this much of the studio.
			studio(rx, ry, rz, lx, ly, metal, 2 * curvature * spacing * 0.4);
			const { radiance, key } = found;
			const grazing = 1 - Math.max(0, facing),
				grazing2 = grazing * grazing;
			const fresnel = reflectance + (1 - reflectance) * grazing2 * grazing2 * grazing;
			const body = (0.05 + height * 0.02) * (1 - metal);
			const light = (body + radiance * fresnel * (1 + metal * 0.4)) * intensity;
			const saturation = metal > 0.5 ? 0.55 - key * 0.35 : 0.9 - key * 0.4;
			sample.color = spectrum(hue + height * 8 - key * 10 - metal * 14 * (1 - Math.min(1, light)), light, Math.max(0.04, saturation));
			sample.level = 1 - Math.exp(-light);
			return sample;
		},
		columns,
		rows,
	);
	// Veiling glare from the key light.
	ctx.globalCompositeOperation = "lighter";
	const halo = ctx.createRadialGradient(
		size.width * (0.5 + lx * 0.6),
		size.height * (0.5 + ly * 0.6),
		0,
		size.width * (0.5 + lx * 0.6),
		size.height * (0.5 + ly * 0.6),
		scale * 0.9,
	);
	halo.addColorStop(0, spectrum(hue, 0.12 * intensity * (0.6 + metal), 0.5));
	halo.addColorStop(1, "rgba(0,0,0,0)");
	ctx.fillStyle = halo;
	ctx.fillRect(0, 0, size.width, size.height);
	ctx.restore();
}
