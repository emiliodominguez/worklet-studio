import { blur, commonProperties, controls, drawable, glow, number, random, TAU } from "../../core/src/index.ts";
import { noise } from "../../core/src/noise.ts";
import { spectrum, surface } from "../../core/src/surface.ts";
import type { PaintContext, PaintProperties, PaintSize } from "../../core/src/types.ts";
export const inputProperties = [...commonProperties, "--nebula-clouds", "--nebula-spread", "--nebula-stars", "--nebula-dust"];

/** Smooth band-limited noise for large structure and directions. @param x Sample x. @param y Sample y. @param seed Variation seed. @returns Noise in about [-1, 1]. */
function smooth(x: number, y: number, seed: number): number {
	return noise(x, y, seed) * 0.68 + noise(x * 2.03 + 5.2, y * 2.03 + 1.3, seed + 17) * 0.32;
}

/** Three octaves; the highest stays below the scanline sampler's Nyquist limit at the nebula's zoom. @param x Sample x. @param y Sample y. @param seed Variation seed. @returns Noise in about [-1, 1]. */
function detailed(x: number, y: number, seed: number): number {
	return noise(x, y, seed) * 0.58 + noise(x * 2.07 + 3.1, y * 2.07 - 7.4, seed + 31) * 0.28 + noise(x * 4.3 - 2.2, y * 4.3 + 4.9, seed + 53) * 0.14;
}

const colors = new Map<number, string>();

/** Quantized, memoized `spectrum`: the gas shader asks for tens of thousands of nearly identical colors per frame. @param hue Hue in degrees. @param light Linear light. @param saturation Color strength. @returns CSS color. */
function emissionColor(hue: number, light: number, saturation: number): string {
	const key = (Math.round(hue) + 4000) * 1e6 + Math.min(4000, Math.round(light * 500)) * 100 + Math.round(saturation * 50);
	let value = colors.get(key);
	if (value === undefined) {
		if (colors.size > 60000) colors.clear();
		value = spectrum(Math.round(hue), Math.min(4000, Math.round(light * 500)) / 500, Math.round(saturation * 50) / 50);
		colors.set(key, value);
	}
	return value;
}

/** Hermite step. @param a Lower edge. @param b Upper edge. @param x Input. @returns Eased value in [0, 1]. */
function step(a: number, b: number, x: number): number {
	const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
	return t * t * (3 - 2 * t);
}

interface Field {
	seed: number;
	spread: number;
	driftX: number;
	driftY: number;
	coreX: number;
	coreY: number;
}

interface Frame {
	width: number;
	height: number;
	zoom: number;
	viewX: number;
	viewY: number;
}

/** Map a CSS x coordinate into nebula space; deeper layers (larger depth) slide further with the view. @param frame Viewport. @param px CSS x. @param depth Parallax depth. @returns World x. */
function worldX(frame: Frame, px: number, depth: number): number {
	return (px - frame.width / 2) * frame.zoom - frame.viewX * 0.12 * depth;
}

/** Map a CSS y coordinate into nebula space. @param frame Viewport. @param py CSS y. @param depth Parallax depth. @returns World y. */
function worldY(frame: Frame, py: number, depth: number): number {
	return (py - frame.height / 2) * frame.zoom - frame.viewY * 0.12 * depth;
}

/** Map nebula space back to CSS x. @param frame Viewport. @param x World x. @param depth Parallax depth. @returns CSS x. */
function screenX(frame: Frame, x: number, depth: number): number {
	return (x + frame.viewX * 0.12 * depth) / frame.zoom + frame.width / 2;
}

/** Map nebula space back to CSS y. @param frame Viewport. @param y World y. @param depth Parallax depth. @returns CSS y. */
function screenY(frame: Frame, y: number, depth: number): number {
	return (y + frame.viewY * 0.12 * depth) / frame.zoom + frame.height / 2;
}

/** Ridged noise: thin bright creases where smooth noise crosses zero, the shape of shocked sheets seen edge-on. @param x Sample x. @param y Sample y. @param seed Variation seed. @returns Value in [0, 1]. */
function ridged(x: number, y: number, seed: number): number {
	const crease = 1 - Math.abs(smooth(x, y, seed));
	return crease * crease * crease * crease;
}

/** Emission-measure density of the ionized gas: a warped band of diffuse gas threaded with sheets. @param field Field parameters. @param x World x. @param y World y. @param fine Whether to include the third octave. @returns Density near [0, 2]. */
function emission(field: Field, x: number, y: number, fine: boolean): number {
	const warp = smooth(x * 0.55 + field.driftX, y * 0.55 + field.driftY, field.seed);
	const ridge = y / field.spread + Math.sin(x * 1.2 + field.driftX * 2) * 0.45 + warp * 0.85;
	const band = Math.exp(-ridge * ridge * 0.85);
	const bx = x * 1.35 + warp * 1.4 + field.driftY,
		by = y * 1.35 - warp * 0.6 + field.driftX;
	const body = fine ? detailed(bx, by, field.seed + 71) : smooth(bx, by, field.seed + 71);
	const sheets = ridged(bx * 0.8 + 7.1, by * 0.8 - 2.3, field.seed + 211);
	const core = Math.exp(-((x - field.coreX) ** 2 + (y - field.coreY) ** 2) * 1.6);
	return Math.max(0, (0.2 + body * 0.8 + sheets * 0.95 + warp * 0.2) * band + core * 0.35 * (0.6 + body * 0.6));
}

/** Column density of the cold molecular dust. @param field Field parameters. @param x World x. @param y World y. @param fine Whether to include the third octave. @returns Dust density in about [-1, 1]. */
function dusty(field: Field, x: number, y: number, fine: boolean): number {
	const dx = x * 1.05 - 3 + field.driftY * 0.6,
		dy = y * 1.05 + 2 + field.driftX * 0.6;
	// Dust lives inside the cloud: it gathers along the same band as the gas, so lanes cut across the glow.
	const warp = smooth(x * 0.55 + field.driftX, y * 0.55 + field.driftY, field.seed);
	const ridge = y / field.spread + Math.sin(x * 1.2 + field.driftX * 2) * 0.45 + warp * 0.85;
	const embedded = Math.exp(-ridge * ridge * 1.2) * 0.4 - 0.2;
	return (fine ? detailed(dx, dy, field.seed + 153) : smooth(dx, dy, field.seed + 153)) + embedded;
}

/** Append a rotated ellipse as its own closed subpath, starting on its outline so no stray edge joins it to the previous one. @param ctx Paint context. @param x Center x. @param y Center y. @param rx Major radius. @param ry Minor radius. @param angle Rotation. */
function lump(ctx: PaintContext, x: number, y: number, rx: number, ry: number, angle: number): void {
	ctx.moveTo(x + Math.cos(angle) * rx, y + Math.sin(angle) * rx);
	ctx.ellipse(x, y, rx, ry, angle, 0, TAU);
}

/** Draw a JWST-style diffraction pattern: three long axes and a short horizontal. @param ctx Paint context. @param x Star x. @param y Star y. @param length Long spike length. @param color RGB triplet. @param alpha Peak opacity. */
function diffraction(ctx: PaintContext, x: number, y: number, length: number, color: string, alpha: number): void {
	const gradient = ctx.createRadialGradient(x, y, 0, x, y, length);
	gradient.addColorStop(0, `rgba(${color}, ${alpha})`);
	gradient.addColorStop(0.18, `rgba(${color}, ${alpha * 0.35})`);
	gradient.addColorStop(1, `rgba(${color}, 0)`);
	ctx.fillStyle = gradient;
	ctx.beginPath();
	const width = Math.max(0.5, length * 0.012);
	for (const [angle, reach] of [
		[Math.PI / 2, 1],
		[Math.PI / 6, 0.82],
		[-Math.PI / 6, 0.82],
		[0, 0.42],
	]) {
		const dx = Math.cos(angle),
			dy = Math.sin(angle);
		const l = length * reach;
		ctx.moveTo(x - dx * l, y - dy * l);
		ctx.lineTo(x - dy * width, y + dx * width);
		ctx.lineTo(x + dx * l, y + dy * l);
		ctx.lineTo(x + dy * width, y - dx * width);
		ctx.closePath();
	}
	ctx.fill();
}

/** Paint an emission nebula: band-limited gas, fibrous multi-scale clouds, ionized filaments, translucent dust lanes with lit dense knots, a young cluster, and a dust-attenuated star field. @param ctx Paint context. @param size CSS dimensions. @param properties CSS inputs. */
export function paint(ctx: PaintContext, size: PaintSize, properties: PaintProperties): void {
	if (!drawable(size)) return;
	const { phase, hue, intensity, seed, viewX, viewY } = controls(properties),
		next = random(seed);
	const clouds = Math.floor(number(properties, "--nebula-clouds", 160, 40, 240));
	const spread = number(properties, "--nebula-spread", 1, 0.3, 1.5);
	const stars = Math.floor(number(properties, "--nebula-stars", 140, 0, 260));
	const dust = number(properties, "--nebula-dust", 0.6, 0, 1);
	const scale = Math.min(size.width, size.height),
		exposure = (clouds / 160) * intensity;
	const frame: Frame = { width: size.width, height: size.height, zoom: 3.2 / scale, viewX, viewY };
	const field: Field = {
		seed,
		spread,
		driftX: Math.cos(phase) * 0.16,
		driftY: Math.sin(phase) * 0.16,
		coreX: (next() - 0.5) * 1.4 * (size.width / scale),
		coreY: (next() - 0.5) * 0.5,
	};
	const coreX = screenX(frame, field.coreX, 1),
		coreY = screenY(frame, field.coreY, 1);
	const primary = hue,
		secondary = hue + 160,
		hot = hue + 45;
	const threshold = 0.42 - dust * 0.32;
	ctx.save();

	// 1. Diffuse gas, shaded below the sampler's Nyquist limit. Brightness rises steeply with density, so most gas stays faint
	// and a few regions glow hot; gas whose density climbs away from the cluster is an ionization front and brightens.
	surface(
		ctx,
		size,
		function shade(u, v) {
			const x = worldX(frame, u * size.width, 1),
				y = worldY(frame, v * size.height, 1);
			const density = emission(field, x, y, true);
			const dx = field.coreX - x,
				dy = field.coreY - y,
				distance = Math.hypot(dx, dy) || 1;
			const front =
				Math.max(0, density - emission(field, x + (dx / distance) * 0.05, y + (dy / distance) * 0.05, false)) *
				Math.exp(-distance * distance * 0.35);
			const zone = step(-0.25, 0.35, smooth(x * 0.7 + 5, y * 0.7 - 3, seed + 9));
			// Thin dust: a smooth optical depth that dims the glow and shifts what survives toward red.
			const depth = Math.max(0, dusty(field, x - viewX * 0.072, y - viewY * 0.072, true) - threshold + 0.3) * dust * 4.5;
			const transmission = Math.exp(-depth);
			const light = (0.006 + Math.pow(density, 2.2) * 0.95 + front * 1.8) * exposure * transmission;
			const tint = primary + (zone - 0.5) * 50 + density * 18 + front * 60;
			const reddening = ((((15 - tint) % 360) + 540) % 360) - 180;
			return emissionColor(tint + reddening * (1 - transmission) * 0.45, light, 0.85 - Math.min(0.55, density * 0.25 + front * 2));
		},
		100,
	);

	ctx.globalCompositeOperation = "lighter";
	/** Ionization gradient: pale gas near the cluster, the secondary line farther out, the primary at the edges. @param alpha Opacity. @returns Fill gradient. */
	function radiance(alpha: number): CanvasGradient {
		const gradient = ctx.createRadialGradient(coreX, coreY, 0, coreX, coreY, scale * 1.1);
		gradient.addColorStop(0, `hsla(${hot}, 70%, 80%, ${alpha * 0.8})`);
		gradient.addColorStop(0.22, `hsla(${secondary}, 85%, 62%, ${alpha * 0.85})`);
		gradient.addColorStop(0.6, `hsla(${primary}, 90%, 55%, ${alpha * 0.7})`);
		gradient.addColorStop(1, `hsla(${primary - 20}, 90%, 45%, ${alpha * 0.5})`);
		return gradient;
	}

	// 2. Sheets: a few large blurred veils, then finer strands. Every element sits on a fixed lattice and its size follows the
	// density, so nothing pops across the loop; sizes vary with a slow noise so the texture never settles into even puffs.
	for (const [columns, softness, alpha, fiber, low, high] of [
		[22, 0.022, 0.22, 1.4, 0.15, 1.2],
		[54, 0.0055, 0.26, 2.6, 0.3, 1.5],
	] as const) {
		const rows = Math.ceil((columns * size.height) / size.width),
			cell = size.width / columns,
			jitter = random(seed + columns);
		ctx.beginPath();
		for (let row = 0; row <= rows; row++) {
			for (let column = 0; column <= columns; column++) {
				const px = (column + jitter() - 0.5) * cell,
					py = (row + jitter() - 0.5) * cell,
					aspect = 0.6 + jitter() * 0.5,
					turn = jitter() * Math.PI;
				const x = worldX(frame, px, 1),
					y = worldY(frame, py, 1);
				const coarse = emission(field, x, y, false);
				if (coarse < low - 0.25) continue;
				const density = emission(field, x, y, true) * Math.exp(-Math.max(0, dusty(field, x, y, false) + 0.1) * dust * 2.2);
				const variety = 0.55 + (smooth(x * 3.1 + 11, y * 3.1 - 4, seed + 37) + 1) * 0.45;
				const radius = cell * 1.1 * variety * step(low, high, density);
				if (radius < 0.4) continue;
				const gx = emission(field, x + 0.03, y, false) - coarse,
					gy = emission(field, x, y + 0.03, false) - coarse;
				const slope = Math.hypot(gx, gy),
					stretch = 1 + fiber * Math.min(1, slope * 9);
				const angle = Math.atan2(gy, gx) + Math.PI / 2 + (turn - Math.PI / 2) * 0.2;
				lump(ctx, px, py, radius * stretch, (radius * aspect) / stretch, angle);
			}
		}
		blur(ctx, scale * softness);
		ctx.fillStyle = radiance(Math.min(1, alpha * exposure));
		ctx.fill();
	}
	// 3. Filaments: short streamlines along density contours.
	const strands = random(seed + 404);
	ctx.beginPath();
	for (let strand = 0; strand < Math.round(clouds * 0.7); strand++) {
		let x = worldX(frame, strands() * size.width, 1),
			y = worldY(frame, strands() * size.height, 1);
		let e = emission(field, x, y, false);
		if (e < 0.35) continue;
		ctx.moveTo(screenX(frame, x, 1), screenY(frame, y, 1));
		for (let s = 0; s < 14; s++) {
			const gx = emission(field, x + 0.01, y, false) - e,
				gy = emission(field, x, y + 0.01, false) - e;
			const length = Math.hypot(gx, gy) || 1;
			x += (-gy / length) * 0.026;
			y += (gx / length) * 0.026;
			e = emission(field, x, y, false);
			ctx.lineTo(screenX(frame, x, 1), screenY(frame, y, 1));
		}
	}
	ctx.lineJoin = "round";
	ctx.lineCap = "round";
	ctx.strokeStyle = radiance(Math.min(1, 0.1 * exposure));
	blur(ctx, 0);
	ctx.lineWidth = 1;
	ctx.stroke();

	// 4. Dust: translucent layers of rising optical depth. Multiplying dims and reddens the gas behind it, so thin dust lets the
	// glow through and only the densest knots go nearly black. Those knots get a lit rim where they face the cluster.
	if (dust > 0) {
		ctx.globalCompositeOperation = "multiply";
		for (const [columns, offset, softness, color, rim] of [
			[60, -0.13, 0.009, "72, 42, 40", false],
			[88, 0.18, 0.0016, "3, 2, 3", true],
		] as const) {
			const rows = Math.ceil((columns * size.height) / size.width),
				cell = size.width / columns,
				jitter = random(seed + 909 + columns),
				level = threshold + offset;
			const lumps: number[] = [];
			for (let row = 0; row <= rows; row++) {
				for (let column = 0; column <= columns; column++) {
					const px = (column + jitter() - 0.5) * cell,
						py = (row + jitter() - 0.5) * cell,
						aspect = 0.55 + jitter() * 0.5,
						turn = jitter() * Math.PI,
						ragged = 0.6 + jitter() * 0.6;
					const x = worldX(frame, px, 1.6),
						y = worldY(frame, py, 1.6);
					const coarse = dusty(field, x, y, false);
					if (coarse + 0.2 < level) continue;
					const density = Math.min(dusty(field, x, y, true), coarse + 0.2) - level;
					const radius = cell * ragged * step(0, 0.12, density);
					if (radius < 0.4) continue;
					// Lumps stretch along the dust contour, so lanes read as wind-blown wisps rather than bubbles.
					const gx = dusty(field, x + 0.03, y, false) - coarse,
						gy = dusty(field, x, y + 0.03, false) - coarse;
					const stretch = 1 + Math.min(rim ? 0.6 : 1.8, Math.hypot(gx, gy) * 16);
					lumps.push(
						screenX(frame, x, 1),
						screenY(frame, y, 1),
						radius * stretch,
						(radius * aspect) / Math.sqrt(stretch),
						Math.atan2(gy, gx) + Math.PI / 2 + (turn - Math.PI / 2) * 0.3,
						rim && emission(field, x, y, false) > 0.55 ? 1 : 0,
					);
				}
			}
			if (!lumps.length) continue;
			if (rim) {
				// A copy nudged toward the cluster survives only along the edges that face its light.
				ctx.globalCompositeOperation = "lighter";
				ctx.beginPath();
				for (let i = 0; i < lumps.length; i += 6) {
					if (!lumps[i + 5]) continue;
					const dx = coreX - lumps[i],
						dy = coreY - lumps[i + 1],
						distance = Math.hypot(dx, dy) || 1;
					lump(ctx, lumps[i] + (dx / distance) * 1.6, lumps[i + 1] + (dy / distance) * 1.6, lumps[i + 2], lumps[i + 3], lumps[i + 4]);
				}
				const glowRim = ctx.createRadialGradient(coreX, coreY, 0, coreX, coreY, scale * 0.9);
				glowRim.addColorStop(0, `hsla(${hot}, 90%, 82%, ${Math.min(1, 0.7 * exposure)})`);
				glowRim.addColorStop(0.5, `hsla(${secondary}, 90%, 68%, ${Math.min(1, 0.32 * exposure)})`);
				glowRim.addColorStop(1, `hsla(${primary}, 90%, 62%, ${Math.min(1, 0.15 * exposure)})`);
				ctx.fillStyle = glowRim;
				blur(ctx, 1.4);
				ctx.fill();
				ctx.globalCompositeOperation = "multiply";
			}
			ctx.beginPath();
			for (let i = 0; i < lumps.length; i += 6) lump(ctx, lumps[i], lumps[i + 1], lumps[i + 2], lumps[i + 3], lumps[i + 4]);
			// The densest knots occlude outright; thinner layers multiply, dimming and reddening what lies behind.
			ctx.globalCompositeOperation = rim ? "source-over" : "multiply";
			ctx.fillStyle = `rgba(${color}, ${rim ? 0.88 : 0.35 + dust * 0.65})`;
			// Dense cores keep a crisp silhouette; antialiasing is enough at that scale.
			blur(ctx, rim ? 0 : scale * softness);
			ctx.fill();
		}
		blur(ctx, 0);
		ctx.globalCompositeOperation = "lighter";
	}

	// 5. The star field: faint unresolved stars in three color temperatures, dimmed behind dust.
	const sky = random(seed + 77);
	const temperatures = ["255, 214, 170", "236, 240, 255", "170, 200, 255"];
	/** Dust transmission toward a background star. @param px CSS x. @param py CSS y. @returns Transmission in (0, 1]. */
	function extinction(px: number, py: number): number {
		return Math.exp(-Math.max(0, dusty(field, worldX(frame, px, 0.4), worldY(frame, py, 0.4), false) + 0.15) * dust * 2.5);
	}
	for (let temperature = 0; temperature < 3; temperature++) {
		ctx.beginPath();
		for (let star = 0; star < Math.ceil((stars * 2) / 3); star++) {
			const px = sky() * size.width - viewX * 4,
				py = sky() * size.height - viewY * 4,
				radius = (0.3 + sky() * 0.45) * Math.min(1, extinction(px, py) * 1.6);
			if (radius < 0.2) continue;
			lump(ctx, px, py, radius, radius, 0);
		}
		ctx.fillStyle = `rgba(${temperatures[temperature]}, ${0.55 * intensity})`;
		ctx.fill();
	}
	// Resolved stars with halos; every so often a bright one with diffraction spikes.
	for (let star = 0; star < stars; star++) {
		const depth = star % 3;
		const px = next() * size.width + viewX * depth * 9,
			py = next() * size.height + viewY * depth * 9,
			radius = 0.45 + next() * 1.1;
		const temperature = temperatures[Math.floor(next() * 3)];
		const light = (0.35 + next() * 0.55) * (0.82 + Math.sin(phase * 2 + star) * 0.18) * intensity * extinction(px, py);
		if (light < 0.06) continue;
		glow(ctx, px, py, radius * 5, `rgba(${temperature}, ${light * 0.25})`);
		ctx.fillStyle = `rgba(${temperature}, ${Math.min(1, light)})`;
		ctx.beginPath();
		ctx.ellipse(px, py, radius, radius, 0, 0, TAU);
		ctx.fill();
		if (star % 23 === 0) diffraction(ctx, px, py, radius * 22, temperature, Math.min(1, light * 0.7));
	}

	// 6. The young cluster that lights the nebula: bloom, a few blue giants, long spikes.
	glow(ctx, coreX, coreY, scale * 0.42, `hsla(${hot}, 80%, 70%, ${0.12 * exposure})`);
	glow(ctx, coreX, coreY, scale * 0.12, `hsla(${hot + 10}, 60%, 88%, ${0.3 * exposure})`);
	const cluster = random(seed + 5);
	for (let star = 0; star < 6; star++) {
		const angle = cluster() * TAU,
			distance = Math.pow(cluster(), 1.5) * scale * 0.09;
		const px = coreX + Math.cos(angle) * distance,
			py = coreY + Math.sin(angle) * distance * 0.8;
		const brightness = (0.55 + cluster() * 0.45) * intensity * (0.9 + Math.sin(phase * 3 + star * 2.1) * 0.1);
		const radius = 1 + cluster() * 1.6;
		glow(ctx, px, py, radius * 14, `rgba(200, 222, 255, ${0.35 * brightness})`);
		glow(ctx, px, py, radius * 4, `rgba(235, 244, 255, ${0.9 * brightness})`);
		ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1, brightness)})`;
		ctx.beginPath();
		ctx.ellipse(px, py, radius, radius, 0, 0, TAU);
		ctx.fill();
		if (star < 3) diffraction(ctx, px, py, radius * (40 + star * 10), "215, 230, 255", Math.min(1, brightness * 0.8));
	}
	ctx.restore();
}
