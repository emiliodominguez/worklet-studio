import { blur, commonProperties, controls, drawable, number, random, TAU, token } from "../../core/src/index.ts";
import { surface } from "../../core/src/surface.ts";
import { contourPath } from "./contours.ts";
import type { PaintContext, PaintProperties, PaintSize } from "../../core/src/types.ts";
export const inputProperties = [...commonProperties, "--metaballs-count", "--metaballs-size", "--metaballs-merging", "--metaballs-material"];

type Rgb = [number, number, number];

interface Ball {
	x: number;
	y: number;
	radius: number;
	weight: number;
}

interface Hit {
	nx: number;
	ny: number;
	nz: number;
	thickness: number;
}

/** Convert a hue into a linear-light tint. @param hue Degrees. @param saturation 0–1 color strength. @param lightness 0–1 HSL lightness. @returns Linear RGB. */
function tint(hue: number, saturation: number, lightness = 0.5): Rgb {
	const a = saturation * Math.min(lightness, 1 - lightness);
	const channels: number[] = [];
	for (const offset of [0, 8, 4]) {
		const k = (((offset + hue / 30) % 12) + 12) % 12;
		channels.push(Math.pow(lightness - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)), 2.2));
	}
	return channels as Rgb;
}

/** Tone-map linear light into a CSS color. @param r Red. @param g Green. @param b Blue. @param alpha Opacity. @returns CSS rgba color. */
function display(r: number, g: number, b: number, alpha = 1): string {
	const map = function map(value: number): number {
		return Math.round(255 * Math.pow(1 - Math.exp(-Math.max(0, value) * 1.15), 1 / 2.2));
	};
	return `rgba(${map(r)},${map(g)},${map(b)},${alpha})`;
}

/** Hermite step between two edges. @param a Lower edge. @param b Upper edge. @param x Input. @returns 0–1 blend. */
function smooth(a: number, b: number, x: number): number {
	const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
	return t * t * (3 - 2 * t);
}

/** Restrict drawing, and therefore blur layers, to a rectangle. @param ctx Paint context. @param x Left. @param y Top. @param width Width. @param height Height. */
function clipRect(ctx: PaintContext, x: number, y: number, width: number, height: number): void {
	ctx.beginPath();
	ctx.moveTo(x, y);
	ctx.lineTo(x + width, y);
	ctx.lineTo(x + width, y + height);
	ctx.lineTo(x, y + height);
	ctx.closePath();
	ctx.clip();
}

/** Paint glass, chrome, or candy droplets that merge inside a lit photo studio, with floor shadows, caustics, and reflections. @param ctx Paint context. @param size CSS dimensions. @param properties CSS inputs. */
export function paint(ctx: PaintContext, size: PaintSize, properties: PaintProperties): void {
	if (!drawable(size)) return;
	const { phase, hue, intensity, seed, viewX, viewY } = controls(properties),
		next = random(seed);
	const count = Math.floor(number(properties, "--metaballs-count", 5, 2, 9));
	const scale = Math.min(size.width, size.height),
		sizeFactor = number(properties, "--metaballs-size", 1, 0.5, 1.5);
	const merging = number(properties, "--metaballs-merging", 1, 0.6, 1.6);
	const mode = token(properties, "--metaballs-material", "glass");
	const material = mode === "chrome" || mode === "candy" ? mode : "glass";
	const aspect = Math.min(1.7, size.width / scale);
	const centerX = size.width / 2,
		centerY = size.height * 0.47;
	const floor = 0.31,
		lightX = -0.45 + viewX * 1.6,
		lightY = -0.7 + viewY * 1.6;
	const lightLength = Math.hypot(lightX, lightY, 1);
	const balls: Ball[] = [];
	let maxHeight = 0;
	for (let i = 0; i < count; i++) {
		const offset = next() * TAU,
			lift = next() * TAU;
		const reach = (0.12 + next() * 0.2) * aspect * (1.15 - count * 0.03),
			bob = 0.05 + next() * 0.1;
		const radius = (0.075 + next() * 0.05) * sizeFactor * (1.1 - count * 0.025);
		const fx = 1 + (i % 2),
			fy = 1 + (i % 3);
		balls.push({
			x: Math.sin(phase * fx + offset) * reach,
			y: Math.min(floor - radius * 1.15, 0.01 + Math.cos(phase * fy + lift) * bob),
			radius: radius * radius,
			weight: radius,
		});
		maxHeight += radius * radius;
	}
	maxHeight = Math.sqrt(maxHeight * merging);
	const distances = new Float64Array(count);
	const accent = tint(hue, 0.85),
		pale = tint(hue + 20, 0.35, 0.62),
		deep = tint(hue - 15, 0.9, 0.35);

	/** Height-only part of the studio sweep: ambient falloff, a lit floor, and a soft horizon. @param y Scene y. @returns Linear light. */
	function stage(y: number): number {
		const floorLight = smooth(floor - 0.05, floor + 0.03, y) * (0.012 - smooth(floor, floor + 0.4, y) * 0.009);
		const horizon = Math.exp(-Math.pow((y - floor + 0.015) * 34, 2)) * 0.014;
		return 0.004 + Math.max(0, 0.4 + y) * 0.006 + floorLight + horizon;
	}

	/** Hue-tinted backlight energy at an elliptical distance from its center. @param d Distance in scene units. @returns Linear light. */
	function glowAt(d: number): number {
		return Math.exp(-6 * d * d) * 0.3 + Math.exp(-1.4 * d * d) * 0.045;
	}

	/** Hue-tinted backlight energy behind the droplets. @param x Scene x. @param y Scene y. @returns Linear light. */
	function backlight(x: number, y: number): number {
		return glowAt(Math.sqrt(x * x + ((y + 0.05) * (y + 0.05) * 3.2) / 2.2));
	}

	/** Studio backdrop seen behind the droplets. @param x Scene x. @param y Scene y. @returns Linear RGB. */
	function backdrop(x: number, y: number): Rgb {
		const base = stage(y),
			back = backlight(x, y);
		return [base * 0.92 + back * accent[0], base * 0.96 + back * accent[1], base + back * accent[2]];
	}

	/** Reflected studio: a graded sky, a broad top softbox, two strip lights, a dark horizon band, and a lit floor. @param rx Reflection x. @param ry Reflection y (down). @param rz Reflection toward viewer. @returns Linear RGB. */
	function environment(rx: number, ry: number, rz: number): Rgb {
		const front = smooth(-0.45, 0.2, rz);
		const softbox = smooth(-0.62, -0.42, rx) * smooth(-0.62, -0.42, -rx) * smooth(-0.22, -0.4, ry) * smooth(-1, -0.88, ry) * 3.2;
		const strip = smooth(0.12, 0.04, Math.abs(Math.abs(rx) - 0.78)) * smooth(0.45, 0.25, ry) * smooth(-0.8, -0.6, ry) * 1.6;
		const sky = 0.04 + smooth(0.05, -0.9, ry) * 0.28;
		const band = 1 - Math.exp(-Math.pow((ry - 0.06) * 9, 2)) * 0.92;
		const ground = smooth(0.06, 0.3, ry) * (0.16 - smooth(0.3, 1, ry) * 0.09);
		const lit = ((softbox + strip) * front + sky) * band + ground;
		const behind = backdrop(rx * 0.55, ry * 0.55);
		const w = 1 - front;
		return [lit * (1 - w * 0.7) + behind[0] * w * 2, lit * (1 - w * 0.7) + behind[1] * w * 2, lit * 1.05 * (1 - w * 0.7) + behind[2] * w * 2];
	}

	/** Solve the implicit surface height and normal at a scene point. Outside the silhouette the rim normal is extrapolated so edges stay continuous. @param x Scene x. @param y Scene y. @returns Surface normal and relative thickness. */
	function solve(x: number, y: number): Hit {
		let field = 0;
		for (let i = 0; i < count; i++) {
			const ball = balls[i];
			distances[i] = Math.max(0.00001, (x - ball.x) ** 2 + (y - ball.y) ** 2);
			field += ball.radius / distances[i];
		}
		let z = 0;
		if (field * merging > 1) {
			let low = 0,
				high = maxHeight;
			for (let iteration = 0; iteration < 10; iteration++) {
				const mid = (low + high) / 2;
				let density = 0;
				for (let i = 0; i < count; i++) density += balls[i].radius / (distances[i] + mid * mid);
				if (density * merging > 1) low = mid;
				else high = mid;
			}
			z = (low + high) / 2;
		}
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
		return { nx: nx / length, ny: ny / length, nz: nz / length, thickness: Math.min(1, z / (maxHeight * 0.6)) };
	}

	/** Shade one surface point for the active material. @param x Scene x. @param y Scene y. @returns Linear RGB and specular energy. */
	function shadePoint(x: number, y: number): { color: Rgb; specular: number } {
		const { nx, ny, nz, thickness } = solve(x, y);
		const rx = 2 * nz * nx,
			ry = 2 * nz * ny,
			rz = 2 * nz * nz - 1;
		const env = environment(rx, ry, rz);
		const facing = Math.max(0, nz);
		const keyDot = Math.max(0, (rx * lightX + ry * lightY + rz) / lightLength);
		const specular = Math.pow(keyDot, 320) * 14 + Math.pow(keyDot, 24) * 0.25;
		const rim = Math.pow(1 - facing, 5);
		if (material === "chrome") {
			const fresnel = 0.72 + 0.28 * rim;
			const tone = [0.86 + pale[0] * 0.3, 0.88 + pale[1] * 0.3, 0.92 + pale[2] * 0.3];
			return {
				color: [env[0] * tone[0] * fresnel + specular, env[1] * tone[1] * fresnel + specular, env[2] * tone[2] * fresnel + specular],
				specular,
			};
		}
		if (material === "candy") {
			const diffuse = Math.max(0, (nx * lightX + ny * lightY + nz) / lightLength + 0.35) / 1.35;
			const scatter = Math.pow(1 - thickness, 2.2) * (0.35 + Math.max(0, ny) * 0.9);
			const fresnel = 0.04 + 0.96 * rim;
			const body: Rgb = [
				deep[0] * (0.05 + diffuse * 0.9) + accent[0] * scatter * 1.6,
				deep[1] * (0.05 + diffuse * 0.9) + accent[1] * scatter * 1.6,
				deep[2] * (0.05 + diffuse * 0.9) + accent[2] * scatter * 1.6,
			];
			return {
				color: [
					body[0] * (1 - fresnel) + env[0] * fresnel * 1.1 + specular,
					body[1] * (1 - fresnel) + env[1] * fresnel * 1.1 + specular,
					body[2] * (1 - fresnel) + env[2] * fresnel * 1.1 + specular,
				],
				specular,
			};
		}
		const bend = 0.09 + thickness * 0.22;
		const red = backdrop(x - nx * bend * 0.9, y - ny * bend * 0.9)[0];
		const green = backdrop(x - nx * bend, y - ny * bend)[1];
		const blue = backdrop(x - nx * bend * 1.12, y - ny * bend * 1.12)[2];
		const absorb = 0.5 + thickness * 1.6;
		const internal = 0.5 + 0.5 * Math.pow(facing, 0.6);
		const fresnel = 0.05 + 0.95 * rim;
		const glow = Math.pow(1 - facing, 2) * 0.12 * (1 - rim);
		const fringe = smooth(0.05, 0.2, facing) * smooth(0.5, 0.22, facing) * 0.22;
		const spectral = tint(hue + 140 + (0.35 - facing) * 900, 1);
		return {
			color: [
				(red * Math.exp(-absorb * (1 - pale[0])) * internal + accent[0] * glow) * (1 - fresnel) +
					env[0] * fresnel +
					specular +
					spectral[0] * fringe,
				(green * Math.exp(-absorb * (1 - pale[1])) * internal + accent[1] * glow) * (1 - fresnel) +
					env[1] * fresnel +
					specular +
					spectral[1] * fringe,
				(blue * Math.exp(-absorb * (1 - pale[2])) * internal + accent[2] * glow) * (1 - fresnel) +
					env[2] * fresnel +
					specular +
					spectral[2] * fringe,
			],
			specular,
		};
	}

	const toX = function toX(x: number): number {
			return centerX + (x - viewX * 0.03) * scale;
		},
		toY = function toY(y: number): number {
			return centerY + (y - viewY * 0.03) * scale;
		};
	ctx.save();
	const sweep = ctx.createLinearGradient(0, 0, 0, size.height);
	for (let stop = 0; stop <= 48; stop++) {
		const level = stage(((stop / 48) * size.height - centerY) / scale + viewY * 0.03);
		sweep.addColorStop(stop / 48, display(level * 0.92, level * 0.96, level));
	}
	ctx.fillStyle = sweep;
	ctx.fillRect(0, 0, size.width, size.height);
	ctx.save();
	const squash = Math.sqrt(2.2 / 3.2);
	ctx.translate(toX(0), toY(-0.05));
	ctx.scale(1, squash);
	const glowRadius = scale * 1.4,
		light = ctx.createRadialGradient(0, 0, 0, 0, 0, glowRadius);
	for (let stop = 0; stop <= 14; stop++) {
		const d = (stop / 14) * 1.4,
			energy = glowAt(d);
		light.addColorStop(stop / 14, display(accent[0] * energy, accent[1] * energy, accent[2] * energy, Math.min(1, energy * 4)));
	}
	ctx.globalCompositeOperation = "lighter";
	ctx.fillStyle = light;
	ctx.fillRect(-toX(0), -toY(-0.05) / squash, size.width, size.height / squash);
	ctx.restore();
	ctx.globalCompositeOperation = "source-over";

	for (const ball of balls) {
		const height = Math.max(0, floor - ball.y - ball.weight);
		const spread = ball.weight * (1.25 + height * 2.4) * scale;
		ctx.save();
		ctx.translate(toX(ball.x + height * 0.12 * -lightX), toY(floor));
		ctx.scale(1, 0.16);
		const shadow = ctx.createRadialGradient(0, 0, 0, 0, 0, spread);
		const darkness = 0.75 * Math.exp(-height * 4.5);
		shadow.addColorStop(0, `rgba(0,0,0,${darkness})`);
		shadow.addColorStop(0.45, `rgba(0,0,0,${darkness * 0.55})`);
		shadow.addColorStop(1, "rgba(0,0,0,0)");
		ctx.fillStyle = shadow;
		ctx.fillRect(-spread, -spread, spread * 2, spread * 2);
		if (material !== "chrome") {
			const focus = spread * 0.62,
				caustic = ctx.createRadialGradient(-lightX * focus * 0.4, 0, 0, -lightX * focus * 0.4, 0, focus);
			const energy = (material === "glass" ? 0.6 : 0.35) * intensity * Math.exp(-height * 2.5);
			caustic.addColorStop(0, display(pale[0] * energy * 2, pale[1] * energy * 2, pale[2] * energy * 2, 0.9));
			caustic.addColorStop(0.35, display(accent[0] * energy, accent[1] * energy, accent[2] * energy, 0.5));
			caustic.addColorStop(1, "rgba(0,0,0,0)");
			ctx.globalCompositeOperation = "lighter";
			ctx.fillStyle = caustic;
			ctx.fillRect(-focus * 1.5, -focus, focus * 3, focus * 2);
			ctx.globalCompositeOperation = "source-over";
		}
		ctx.restore();
	}

	const columns = 180,
		rows = 128,
		field = new Float32Array((columns + 1) * (rows + 1));
	let minX = size.width,
		maxX = 0,
		minY = size.height,
		maxY = 0;
	for (let row = 1; row < rows; row++) {
		for (let column = 1; column < columns; column++) {
			const x = ((column / columns - 0.5) * size.width) / scale + viewX * 0.03,
				y = ((row / rows) * size.height - centerY) / scale + viewY * 0.03;
			let value = 0;
			for (const ball of balls) value += ball.radius / Math.max(0.00001, (x - ball.x) ** 2 + (y - ball.y) ** 2);
			field[row * (columns + 1) + column] = value;
			if (value * merging > 0.75) {
				minX = Math.min(minX, ((column - 1) / columns) * size.width);
				maxX = Math.max(maxX, ((column + 1) / columns) * size.width);
				minY = Math.min(minY, ((row - 1) / rows) * size.height);
				maxY = Math.max(maxY, ((row + 1) / rows) * size.height);
			}
		}
	}
	if (maxX <= minX || maxY <= minY) {
		ctx.restore();
		return;
	}
	const floorScreen = toY(floor);
	ctx.save();
	clipRect(ctx, minX - 8, floorScreen - 4, maxX - minX + 16, Math.max(0, floorScreen - minY) * 0.55 + 12);
	ctx.save();
	ctx.translate(0, floorScreen);
	ctx.scale(1, -0.55);
	ctx.translate(0, -floorScreen);
	contourPath(ctx, field, columns, rows, size.width, size.height, 1 / merging);
	ctx.restore();
	const mirror = ctx.createLinearGradient(0, floorScreen, 0, floorScreen + scale * 0.2);
	const tone = material === "chrome" ? pale : accent;
	mirror.addColorStop(0, display(tone[0] * 0.5 + 0.08, tone[1] * 0.5 + 0.08, tone[2] * 0.5 + 0.08, 0.32));
	mirror.addColorStop(1, "rgba(0,0,0,0)");
	blur(ctx, Math.max(1, scale * 0.004));
	ctx.fillStyle = mirror;
	ctx.fill("evenodd");
	ctx.restore();

	contourPath(ctx, field, columns, rows, size.width, size.height, 1 / merging);
	ctx.save();
	ctx.clip("evenodd");
	minX = Math.floor(minX);
	minY = Math.floor(minY);
	const boxWidth = Math.ceil(maxX) - minX,
		boxHeight = Math.ceil(maxY) - minY;
	const glints: { x: number; y: number; energy: number }[] = [];
	ctx.translate(minX, minY);
	surface(
		ctx,
		{ width: boxWidth, height: boxHeight },
		function shade(u, v) {
			const px = minX + u * boxWidth,
				py = minY + v * boxHeight;
			const x = (px - centerX) / scale + viewX * 0.03,
				y = (py - centerY) / scale + viewY * 0.03;
			let reach = 0;
			for (const ball of balls) reach += ball.radius / Math.max(0.00001, (x - ball.x) ** 2 + (y - ball.y) ** 2);
			if (reach * merging < 0.45) return "transparent";
			const { color } = shadePoint(x, y);
			return display(color[0] * intensity, color[1] * intensity, color[2] * intensity);
		},
		128,
	);
	ctx.restore();
	for (let row = 0; row <= 30; row++) {
		for (let column = 0; column <= 40; column++) {
			const px = minX + (column / 40) * boxWidth,
				py = minY + (row / 30) * boxHeight;
			const x = (px - centerX) / scale + viewX * 0.03,
				y = (py - centerY) / scale + viewY * 0.03;
			let value = 0;
			for (const ball of balls) value += ball.radius / Math.max(0.00001, (x - ball.x) ** 2 + (y - ball.y) ** 2);
			if (value * merging < 1.05) continue;
			const { specular } = shadePoint(x, y);
			if (specular > 0.6) glints.push({ x: px, y: py, energy: Math.min(1, specular / 6) });
		}
	}
	ctx.globalCompositeOperation = "lighter";
	ctx.save();
	const bloom = scale * 0.012;
	clipRect(ctx, minX - bloom * 4, minY - bloom * 4, boxWidth + bloom * 8, boxHeight + bloom * 8);
	blur(ctx, bloom);
	ctx.fillStyle = display(pale[0] * 1.5 + 0.4, pale[1] * 1.5 + 0.4, pale[2] * 1.5 + 0.4, 0.45 * Math.min(1.4, intensity));
	ctx.beginPath();
	for (const glint of glints) {
		const radius = Math.max(1, (boxWidth / 40) * (0.6 + glint.energy * 0.8));
		ctx.moveTo(glint.x + radius, glint.y);
		ctx.arc(glint.x, glint.y, radius, 0, TAU);
	}
	ctx.fill();
	ctx.restore();
	contourPath(ctx, field, columns, rows, size.width, size.height, 1 / merging);
	const rim = display(
		pale[0] * 1.2 + 0.15,
		pale[1] * 1.2 + 0.15,
		pale[2] * 1.2 + 0.15,
		material === "chrome" ? 0.06 : material === "candy" ? 0.16 : 0.26,
	);
	ctx.strokeStyle = rim;
	ctx.lineWidth = Math.max(0.6, scale * 0.0012);
	ctx.stroke();
	ctx.restore();
}
