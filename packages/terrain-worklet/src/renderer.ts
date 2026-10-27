import { blur, commonProperties, controls, drawable, glow, number, random, TAU } from "../../core/src/index.ts";
import { noise } from "../../core/src/noise.ts";
import type { PaintContext, PaintProperties, PaintSize } from "../../core/src/types.ts";
export const inputProperties = [...commonProperties, "--terrain-lines", "--terrain-height", "--terrain-complexity", "--terrain-perspective"];

type Rgb = [number, number, number];

/** Convert HSL to linear-ish display RGB channels. @param h Hue in degrees. @param s Saturation 0–1. @param l Lightness 0–1. @returns RGB channels 0–255. */
function hsl(h: number, s: number, l: number): Rgb {
	const a = s * Math.min(l, 1 - l),
		channels: number[] = [];
	for (const offset of [0, 8, 4]) {
		const k = (((offset + h / 30) % 12) + 12) % 12;
		channels.push(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
	}
	return [channels[0], channels[1], channels[2]];
}

/** Format channels as a CSS color. @param c RGB channels. @param alpha Opacity. @returns CSS color. */
function css(c: Rgb, alpha = 1): string {
	return `rgba(${Math.max(0, Math.min(255, Math.round(c[0])))},${Math.max(0, Math.min(255, Math.round(c[1])))},${Math.max(0, Math.min(255, Math.round(c[2])))},${alpha})`;
}

/** Blend two colors. @param a Start. @param b End. @param t Mix 0–1. @returns Mixed channels. */
function mix(a: Rgb, b: Rgb, t: number): Rgb {
	return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/** Band-limited fractal noise: octaves finer than the sampling grid fade out instead of aliasing into spikes and vertical streaks. @param x Sample x. @param z Sample z. @param seed Variation seed. @param detail Number of octaves the grid can resolve (fractional values fade the last one). @returns Fractal noise roughly in [-1, 1]. */
function landscape(x: number, z: number, seed: number, detail: number): number {
	let value = 0,
		weight = 0.55;
	for (let octave = 0; octave < 5 && octave < detail; octave++) {
		value += noise(x, z, seed + octave * 17) * weight * Math.min(1, detail - octave);
		x = x * 2.03 + 13.7;
		z = z * 2.03 + 9.2;
		weight *= 0.48;
	}
	return value;
}

/** Paint a shaded mountain range at dusk: sky and sun, hill-shaded ridges that fade into haze with distance, valley mist and glowing ridge contours. @param ctx Paint context. @param size CSS dimensions. @param properties CSS inputs. */
export function paint(ctx: PaintContext, size: PaintSize, properties: PaintProperties): void {
	if (!drawable(size)) return;
	const { phase, hue, intensity, seed, viewX, viewY } = controls(properties);
	const lines = Math.floor(number(properties, "--terrain-lines", 90, 20, 150));
	const elevation = number(properties, "--terrain-height", 0.85, 0, 1.5);
	const complexity = number(properties, "--terrain-complexity", 2.2, 0.5, 5);
	const perspective = number(properties, "--terrain-perspective", 0.65, 0, 1);
	const { width, height } = size;
	const t = phase + seed * 0.011;
	const exposure = Math.min(1.6, intensity);
	const horizon = height * (0.36 + viewY * 0.03);
	const sunX = width * (0.3 + viewX * 0.08),
		sunY = horizon - height * 0.07;
	const skyTop = hsl(hue + 15, 0.55, 0.035 * exposure),
		skyHorizon = hsl(hue + 30, 0.5, 0.3 * exposure),
		haze = hsl(hue + 25, 0.42, 0.27 * exposure),
		sunColor = hsl(hue + 45, 0.85, 0.82),
		rock = hsl(hue - 5, 0.34, 0.36),
		shade = hsl(hue + 15, 0.5, 0.025),
		ridgeLight = hsl(hue + 30, 0.9, 0.72);
	ctx.save();
	const sky = ctx.createLinearGradient(0, 0, 0, horizon + height * 0.1);
	sky.addColorStop(0, css(skyTop));
	sky.addColorStop(0.65, css(mix(skyTop, skyHorizon, 0.45)));
	sky.addColorStop(1, css(skyHorizon));
	ctx.fillStyle = sky;
	ctx.fillRect(0, 0, width, height);
	const next = random(seed + 3);
	for (let star = 0; star < 90; star++) {
		const x = next() * width,
			y = Math.pow(next(), 1.6) * horizon * 0.85,
			r = 0.3 + Math.pow(next(), 4) * 1.2;
		ctx.fillStyle = `rgba(230, 238, 255, ${(0.15 + next() * 0.55) * (1 - y / horizon) * exposure})`;
		ctx.fillRect(x, y, r, r);
	}
	ctx.globalCompositeOperation = "lighter";
	glow(ctx, sunX, sunY, height * 0.9, css(sunColor, 0.1 * exposure));
	glow(ctx, sunX, sunY, height * 0.28, css(sunColor, 0.28 * exposure));
	glow(ctx, sunX, sunY, height * 0.05, css(sunColor, 0.9 * exposure));
	ctx.fillStyle = css(mix(sunColor, [255, 255, 255], 0.5), Math.min(1, exposure));
	ctx.beginPath();
	ctx.arc(sunX, sunY, height * 0.018, 0, TAU);
	ctx.fill();
	ctx.globalCompositeOperation = "source-over";
	// Heightfield cache: every row is sampled once and reused for its ridge, its neighbors' normals and the strip below it.
	const columns = Math.min(150, Math.round(70 + complexity * 26));
	const rows = lines + 1;
	const heights = new Float64Array(rows * (columns + 1));
	const depths = new Float64Array(rows);
	const ys = new Float64Array(rows * (columns + 1));
	const xs = new Float64Array(rows * (columns + 1));
	const swayX = Math.sin(t) * 0.25,
		swayZ = Math.cos(t) * 0.2;
	for (let row = 0; row < rows; row++) {
		const v = row / lines,
			depth = Math.pow(v, 1 + perspective * 0.8);
		depths[row] = depth;
		const spread = 2.4 - depth * 1.4;
		// Keep at least two samples per finest wavelength across the row.
		const detail = 1 + Math.log2(Math.max(1, columns / (spread * complexity * 3 * 2)));
		for (let column = 0; column <= columns; column++) {
			const u = column / columns;
			const wx = (u - 0.5) * spread * complexity * 3 + swayX,
				wz = v * complexity * 2 + swayZ;
			const ridged = 1 - Math.abs(noise(wx * 0.9 + 4.1, wz * 0.9, seed + 5));
			const raw = landscape(wx, wz, seed, detail) * 0.85 + ridged * ridged * 0.45 + 0.12;
			// A soft floor keeps plains gently rolling instead of perfectly flat.
			const h = (Math.log(1 + Math.exp(raw * 8)) / 8) * elevation;
			const index = row * (columns + 1) + column;
			heights[index] = h;
			xs[index] = width * (0.5 + (u - 0.5) * 1.08 + viewX * (depth - 0.5) * 0.04);
			ys[index] = horizon + depth * (height * 1.5 - horizon) - h * height * (0.14 + depth * 0.3);
		}
	}
	const lightX = (sunX / width - 0.5) * 1.8,
		lightLength = Math.hypot(lightX, 0.75, 0.55);
	const mistRows = [Math.floor(lines * 0.3), Math.floor(lines * 0.55), Math.floor(lines * 0.78)];
	for (let row = 0; row < lines; row++) {
		const depth = depths[row],
			base = row * (columns + 1),
			below = base + columns + 1;
		const fog = Math.exp(-depth * 4) * 0.88;
		const gradient = ctx.createLinearGradient(xs[base], 0, xs[base + columns], 0);
		for (let column = 0; column <= columns; column++) {
			const left = Math.max(0, column - 1),
				right = Math.min(columns, column + 1);
			const dx = ((heights[base + right] - heights[base + left]) * columns) / (right - left) / (complexity * 2.5);
			const dz = ((heights[below + column] - heights[base + column]) * lines) / (complexity * 1.6);
			const length = Math.hypot(dx, 1, dz);
			const nx = -dx / length,
				ny = 1 / length,
				nz = -dz / length;
			const sun = Math.max(0, (nx * lightX + ny * 0.75 + nz * -0.55) / lightLength);
			const rim = Math.pow(Math.max(0, -nz), 2) * 0.2;
			const peak = Math.min(1, heights[base + column] / Math.max(0.2, elevation));
			const albedo = 0.7 + peak * peak * 0.8;
			let color = mix(shade, rock, Math.min(1.2, sun * sun * 1.15 * albedo + ny * 0.12));
			color = mix(color, sunColor, Math.pow(sun, 6) * 0.35 + rim);
			// Tall strips are cliff faces dropping toward the viewer: shade them as occluded rock rather than stretching the ridge color.
			const drop = Math.max(0, (row === lines - 1 ? height : ys[below + column]) - ys[base + column]);
			color = mix(shade, color, 0.12 + 0.88 * Math.exp(-drop / (height * 0.028)));
			color = mix(color, haze, fog);
			gradient.addColorStop(column / columns, css([color[0] * exposure, color[1] * exposure, color[2] * exposure]));
		}
		// Each strip spans its ridge down to the next ridge; nearer strips cover the rest, so overdraw stays near one screen.
		ctx.fillStyle = gradient;
		ctx.beginPath();
		ctx.moveTo(xs[base] - width * 0.05, ys[base]);
		for (let column = 0; column <= columns; column++) ctx.lineTo(xs[base + column], ys[base + column]);
		ctx.lineTo(xs[base + columns] + width * 0.05, ys[base + columns]);
		if (row === lines - 1) {
			ctx.lineTo(width * 1.1, height + 2);
			ctx.lineTo(-width * 0.1, height + 2);
		} else {
			ctx.lineTo(xs[below + columns] + width * 0.05, ys[below + columns] + 2);
			for (let column = columns; column >= 0; column--) ctx.lineTo(xs[below + column], ys[below + column] + 2);
			ctx.lineTo(xs[below] - width * 0.05, ys[below] + 2);
		}
		ctx.closePath();
		ctx.fill();
		const major = row % 5 === 0;
		const lineAlpha = (major ? 0.5 : 0.09) * (0.15 + depth * 0.85) * (1 - fog * 0.8) * exposure;
		if (lineAlpha > 0.004) {
			ctx.beginPath();
			ctx.moveTo(xs[base], ys[base]);
			for (let column = 1; column <= columns; column++) ctx.lineTo(xs[base + column], ys[base + column]);
			ctx.globalCompositeOperation = "lighter";
			// Ridges catch the low light most strongly near the sun's bearing.
			const rimlight = ctx.createLinearGradient(0, 0, width, 0);
			rimlight.addColorStop(0, css(ridgeLight, lineAlpha * 0.55));
			rimlight.addColorStop(Math.max(0, Math.min(1, sunX / width)), css(mix(ridgeLight, sunColor, 0.5), Math.min(1, lineAlpha * 1.8)));
			rimlight.addColorStop(1, css(ridgeLight, lineAlpha * 0.45));
			if (major) {
				ctx.globalAlpha = 0.2;
				ctx.strokeStyle = rimlight;
				ctx.lineWidth = 3.5;
				ctx.stroke();
				ctx.globalAlpha = 1;
			}
			ctx.strokeStyle = rimlight;
			ctx.lineWidth = major ? 0.9 : 0.55;
			ctx.stroke();
			ctx.globalCompositeOperation = "source-over";
		}
		if (mistRows.includes(row)) {
			// Valley mist: a soft, blurred band resting on this depth's ground plane, hidden by nearer ridges.
			const ground = horizon + depth * (height * 1.5 - horizon);
			const thickness = height * (0.045 + depth * 0.06);
			ctx.save();
			blur(ctx, thickness * 0.6);
			ctx.fillStyle = css(mix(haze, sunColor, 0.2), (0.45 - depth * 0.22) * exposure);
			ctx.beginPath();
			ctx.moveTo(-width * 0.1, ground + thickness);
			for (let step = 0; step <= 24; step++) {
				const u = step / 24;
				const drift = noise(u * 5 + Math.cos(t) * 0.6, row * 0.37 + Math.sin(t) * 0.3, seed + row);
				ctx.lineTo(width * (u * 1.2 - 0.1), ground - thickness * (1.2 + drift * 0.9));
			}
			ctx.lineTo(width * 1.1, ground + thickness);
			ctx.closePath();
			ctx.fill();
			ctx.restore();
		}
	}
	// Foreground vignette grounds the composition.
	const floor = ctx.createLinearGradient(0, height * 0.7, 0, height);
	floor.addColorStop(0, "rgba(0, 0, 0, 0)");
	floor.addColorStop(1, `rgba(0, 0, 0, 0.45)`);
	ctx.fillStyle = floor;
	ctx.fillRect(0, height * 0.7, width, height * 0.3);
	ctx.restore();
}
