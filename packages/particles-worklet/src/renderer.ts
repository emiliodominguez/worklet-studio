import { blur, commonProperties, controls, drawable, glow, number, random, TAU, token } from "../../core/src/index.ts";
import type { PaintContext, PaintSize, PaintProperties } from "../../core/src/types.ts";

export const inputProperties = [
	...commonProperties,
	"--particles-count",
	"--particles-size-min",
	"--particles-size-max",
	"--particles-lines-threshold",
	"--particles-background",
	"--particles-glow",
	"--particles-drift",
	"--particles-layout",
	"--particles-focus",
];

interface Particle {
	x: number;
	y: number;
	radius: number;
	hue: number;
	saturation: number;
	depth: number;
	light: number;
	field: boolean;
}

/** Spiral-arm angle for a disk radius; a logarithmic spiral like a grand-design galaxy. @param r Disk radius in [0, 1]. @returns Angle in radians. */
function armAngle(r: number): number {
	return Math.log(1 + r / 0.08) * 1.45;
}

/** Approximate a standard normal sample from three uniforms. @param next Seeded random source. @returns A value with mean 0 and unit-ish spread. */
function gaussian(next: () => number): number {
	return (next() + next() + next() - 1.5) * 2;
}

/** Place a galaxy population member in disk-plane coordinates. @param next Seeded random source. @param i Particle index. @param arms Arm count. @returns Disk radius, angle, and population. */
function galaxyStar(next: () => number, i: number, arms: number): { r: number; angle: number; population: number } {
	const population = next();
	if (population < 0.62) {
		// Young arm stars: concentrated on the spiral with outward scatter.
		const r = Math.max(0.05, 0.06 + Math.pow(next(), 0.9) * 0.94 + gaussian(next) * 0.025);
		return { r, angle: armAngle(r) + ((i % arms) * TAU) / arms + gaussian(next) * (0.1 + r * 0.16), population };
	}
	if (population < 0.88) {
		// Old disk and bulge stars: exponential falloff and no spiral structure.
		const r = Math.min(1.05, -Math.log(1 - next() * 0.98) * 0.22);
		return { r, angle: next() * TAU, population };
	}
	// Foreground field stars scattered across the whole surface.
	return { r: -1, angle: next() * TAU, population };
}

/** Append a spiral band (one arm) to the current path in unit disk coordinates. @param ctx Paint context. @param offset Arm angle offset. @param from Inner radius. @param to Outer radius. @param width Band half-width as a function of radius. @param shift Angular offset relative to the arm ridge. */
function band(ctx: PaintContext, offset: number, from: number, to: number, width: (r: number) => number, shift = 0): void {
	const steps = 64,
		outer: number[] = [],
		inner: number[] = [];
	for (let step = 0; step <= steps; step++) {
		const r = from + ((to - from) * step) / steps;
		const angle = armAngle(r) + offset + shift;
		const w = width(r);
		outer.push(Math.cos(angle) * (r + w), Math.sin(angle) * (r + w));
		inner.push(Math.cos(angle) * Math.max(0, r - w), Math.sin(angle) * Math.max(0, r - w));
	}
	ctx.moveTo(outer[0], outer[1]);
	for (let i = 2; i < outer.length; i += 2) ctx.lineTo(outer[i], outer[i + 1]);
	for (let i = inner.length - 2; i >= 0; i -= 2) ctx.lineTo(inner[i], inner[i + 1]);
	ctx.closePath();
}

/** Paint the diffuse light of a spiral galaxy: disk, arms, dust lanes, bulge, and HII regions. @param ctx Paint context. @param next Seeded random source. @param cx Center x. @param cy Center y. @param extent Disk radius in CSS px. @param tilt Major-axis rotation. @param squash Inclination foreshortening. @param spin Disk rotation. @param hue Base hue. @param intensity Exposure. */
function galaxyLight(
	ctx: PaintContext,
	next: () => number,
	cx: number,
	cy: number,
	extent: number,
	tilt: number,
	squash: number,
	spin: number,
	hue: number,
	intensity: number,
): void {
	const arms = 2;
	ctx.save();
	ctx.translate(cx, cy);
	ctx.rotate(tilt);
	ctx.scale(extent, extent * squash);
	ctx.rotate(spin);
	ctx.globalCompositeOperation = "lighter";
	const disk = ctx.createRadialGradient(0, 0, 0, 0, 0, 1.15);
	disk.addColorStop(0, `hsla(40, 70%, 82%, ${0.5 * intensity})`);
	disk.addColorStop(0.12, `hsla(${hue + 165}, 55%, 62%, ${0.3 * intensity})`);
	disk.addColorStop(0.4, `hsla(${hue}, 70%, 58%, ${0.14 * intensity})`);
	disk.addColorStop(0.75, `hsla(${hue}, 70%, 52%, ${0.05 * intensity})`);
	disk.addColorStop(1, `hsla(${hue}, 70%, 40%, 0)`);
	ctx.fillStyle = disk;
	ctx.fillRect(-1.2, -1.2, 2.4, 2.4);
	// Unresolved young stars along the arms: a wide soft band and a tighter bright ridge.
	const armLight = ctx.createRadialGradient(0, 0, 0, 0, 0, 1.05);
	armLight.addColorStop(0, `hsla(${hue + 170}, 60%, 70%, ${0.6 * intensity})`);
	armLight.addColorStop(0.35, `hsla(${hue - 5}, 85%, 68%, ${0.55 * intensity})`);
	armLight.addColorStop(0.75, `hsla(${hue}, 85%, 64%, ${0.25 * intensity})`);
	armLight.addColorStop(1, `hsla(${hue + 10}, 85%, 60%, 0)`);
	ctx.fillStyle = armLight;
	ctx.beginPath();
	for (let arm = 0; arm < arms; arm++)
		band(ctx, (arm * TAU) / arms, 0.06, 1.05, function wide(r) {
			return 0.04 + r * 0.12;
		});
	blur(ctx, extent * 0.035);
	ctx.fill();
	ctx.beginPath();
	for (let arm = 0; arm < arms; arm++)
		band(ctx, (arm * TAU) / arms, 0.1, 0.95, function ridge(r) {
			return 0.008 + r * 0.025;
		});
	blur(ctx, extent * 0.008);
	ctx.fill();
	blur(ctx, 0);
	// Unresolved star clouds: thousands of faint points that fill the arms between the resolved stars.
	for (const [population, color, count] of [
		["arm", `hsla(${hue - 5}, 70%, 82%, ${0.38 * intensity})`, 1300],
		["disk", `hsla(40, 70%, 78%, ${0.3 * intensity})`, 700],
	] as const) {
		const cloud = random(Math.round(hue) + count);
		ctx.fillStyle = color;
		ctx.beginPath();
		for (let i = 0; i < count; i++) {
			let r: number, angle: number;
			if (population === "arm") {
				r = 0.05 + Math.pow(cloud(), 0.85) * 1.0;
				angle = armAngle(r) + ((i % arms) * TAU) / arms + gaussian(cloud) * (0.12 + r * 0.22);
			} else {
				r = Math.min(1.1, -Math.log(1 - cloud() * 0.98) * 0.2);
				angle = cloud() * TAU;
			}
			const radius = 0.0015 + cloud() * 0.0025;
			const x = Math.cos(angle) * r,
				y = Math.sin(angle) * r;
			ctx.moveTo(x + radius, y);
			ctx.ellipse(x, y, radius, radius, 0, 0, TAU);
		}
		ctx.fill();
	}
	// Dust lanes trail along the inner, concave edge of each arm.
	ctx.globalCompositeOperation = "source-over";
	ctx.fillStyle = `rgba(5, 3, 8, ${0.6 * Math.min(1, intensity + 0.2)})`;
	ctx.beginPath();
	for (let arm = 0; arm < arms; arm++)
		for (let segment = 0; segment < 6; segment++) {
			const from = 0.05 + segment * 0.14 + next() * 0.02,
				to = from + 0.12 + next() * 0.06;
			band(
				ctx,
				(arm * TAU) / arms,
				from,
				to,
				function lane(r) {
					return (0.004 + r * 0.012) * Math.sqrt(Math.sin(((r - from) / (to - from)) * Math.PI));
				},
				0.2,
			);
		}
	blur(ctx, extent * 0.007);
	ctx.fill();
	blur(ctx, 0);
	ctx.globalCompositeOperation = "lighter";
	// The bulge sits above the inner dust.
	const bulge = ctx.createRadialGradient(0, 0, 0, 0, 0, 0.26);
	bulge.addColorStop(0, `rgba(255, 246, 228, ${0.95 * intensity})`);
	bulge.addColorStop(0.12, `hsla(40, 80%, 80%, ${0.55 * intensity})`);
	bulge.addColorStop(0.45, `hsla(32, 70%, 62%, ${0.16 * intensity})`);
	bulge.addColorStop(1, "hsla(30, 70%, 50%, 0)");
	ctx.fillStyle = bulge;
	ctx.beginPath();
	ctx.ellipse(0, 0, 0.26, 0.26, 0, 0, TAU);
	ctx.fill();
	// Pink HII star-forming knots on the outer edge of the arms.
	for (let knot = 0; knot < 26; knot++) {
		const r = 0.22 + next() * 0.72,
			angle = armAngle(r) + ((knot % arms) * TAU) / arms + 0.08 + gaussian(next) * 0.05;
		const x = Math.cos(angle) * r,
			y = Math.sin(angle) * r,
			radius = 0.008 + next() * 0.016;
		const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
		gradient.addColorStop(0, `hsla(${hue + 120}, 95%, 82%, ${0.85 * intensity})`);
		gradient.addColorStop(0.4, `hsla(${hue + 115}, 90%, 62%, ${0.35 * intensity})`);
		gradient.addColorStop(1, `hsla(${hue + 110}, 90%, 50%, 0)`);
		ctx.fillStyle = gradient;
		ctx.beginPath();
		ctx.ellipse(x, y, radius, radius, 0, 0, TAU);
		ctx.fill();
	}
	ctx.restore();
}

/** Draw four tapered diffraction spikes around a bright star with filled paths, not strokes. @param ctx Paint context. @param x Star x. @param y Star y. @param length Spike length. @param width Spike base width. @param color Core color. */
function spikes(ctx: PaintContext, x: number, y: number, length: number, width: number, color: string): void {
	const gradient = ctx.createRadialGradient(x, y, 0, x, y, length);
	gradient.addColorStop(0, color);
	gradient.addColorStop(0.25, color.replace(/[\d.]+\)$/, "0.25)"));
	gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
	ctx.fillStyle = gradient;
	ctx.beginPath();
	ctx.moveTo(x - length, y);
	ctx.lineTo(x, y - width);
	ctx.lineTo(x + length, y);
	ctx.lineTo(x, y + width);
	ctx.closePath();
	ctx.moveTo(x, y - length);
	ctx.lineTo(x + width, y);
	ctx.lineTo(x, y + length);
	ctx.lineTo(x - width, y);
	ctx.closePath();
	ctx.fill();
}

/** Render a deterministic constellation or galaxy with depth of field, bloom, twinkle, and bounded spatial-neighbor searches. @param ctx Paint context. @param size CSS-pixel dimensions. @param properties CSS inputs. */
export function paint(ctx: PaintContext, size: PaintSize, properties: PaintProperties): void {
	if (!drawable(size)) return;
	const { phase, seed, hue, intensity, viewX, viewY } = controls(properties);
	const next = random(seed);
	const count = Math.floor(number(properties, "--particles-count", 130, 0, 800));
	const min = number(properties, "--particles-size-min", 0.6, 0, 30);
	const max = number(properties, "--particles-size-max", 2.4, min, 40);
	const threshold = number(properties, "--particles-lines-threshold", 115, 0, 400);
	const drift = number(properties, "--particles-drift", 35, 0, 200);
	const galaxy = token(properties, "--particles-layout", "field") === "galaxy";
	const bloom = number(properties, "--particles-glow", 1, 0, 2);
	const focus = number(properties, "--particles-focus", 0.62, 0, 1);
	ctx.fillStyle = token(properties, "--particles-background", "#111");
	ctx.fillRect(0, 0, size.width, size.height);
	const particles: Particle[] = [];
	const cells = new Map<string, number[]>();
	const cellSize = Math.max(1, threshold);
	const extent = Math.min(size.width * 0.5, size.height * 0.92);
	const tilt = -0.32 + viewX * 0.08,
		squash = 0.46 + viewY * 0.05;
	const cx = size.width / 2 + viewX * 26,
		cy = size.height / 2 + viewY * 26;
	for (let i = 0; i < count; i++) {
		let x = next() * size.width + Math.sin(phase + next() * TAU) * drift;
		let y = next() * size.height + Math.cos(phase + next() * TAU) * drift;
		let depth = 0.15 + next() * 0.85;
		let tint = hue + next() * 65,
			saturation = 35 + next() * 55;
		const light = next();
		let field = true;
		if (galaxy) {
			const star = galaxyStar(next, i, 2);
			if (star.r >= 0) {
				const angle = star.angle + phase,
					jitter = Math.sin(phase + i * 2.3) * drift * 0.04;
				const dx = Math.cos(angle) * star.r * extent + jitter,
					dy = Math.sin(angle) * star.r * extent * squash;
				x = cx + dx * Math.cos(tilt) - dy * Math.sin(tilt);
				y = cy + dx * Math.sin(tilt) + dy * Math.cos(tilt);
				depth = focus + Math.sin(angle) * 0.08 + (light - 0.5) * 0.1;
				field = false;
				// Arms burn blue-white; the old disk and bulge glow gold.
				if (star.population < 0.62) {
					tint = hue + (next() - 0.5) * 30;
					saturation = 40 + next() * 40;
				} else {
					tint = hue + 180 + (next() - 0.5) * 30;
					saturation = 45 + next() * 35;
				}
			} else depth = 0.15 + light * 0.25;
		} else {
			// A few stars run hot or cool against the palette, like real color temperature.
			if (light > 0.86) tint = hue + 170 + light * 20;
			x += viewX * depth * 70;
			y += viewY * depth * 70;
		}
		particles.push({ x, y, radius: min + next() * (max - min), hue: tint, saturation, depth, light, field });
		const key = `${Math.floor(x / cellSize)},${Math.floor(y / cellSize)}`;
		const bucket = cells.get(key) || [];
		bucket.push(i);
		cells.set(key, bucket);
	}
	ctx.save();
	ctx.globalCompositeOperation = "lighter";
	if (count > 0) {
		const reach = Math.min(size.width, size.height);
		glow(ctx, size.width * 0.3 + viewX * 30, size.height * 0.4, reach * 0.9, `hsla(${hue}, 85%, 45%, ${0.1 * intensity})`);
		glow(ctx, size.width * 0.75, size.height * 0.7, reach * 0.65, `hsla(${hue + 65}, 85%, 45%, ${0.06 * intensity})`);
		if (galaxy) galaxyLight(ctx, random(seed + 7), cx, cy, extent, tilt, squash, phase, hue, intensity);
	}
	if (threshold > 0) {
		// Links are bucketed by opacity and weight so thousands of segments cost a handful of strokes.
		const levels = 5,
			paths: [number, number, number, number][][] = [];
		for (let i = 0; i < levels * 2; i++) paths.push([]);
		for (let i = 0; i < count; i++) {
			const a = particles[i];
			const cx = Math.floor(a.x / cellSize),
				cy = Math.floor(a.y / cellSize);
			let checked = 0;
			neighbors: for (let dx = -1; dx <= 1; dx++) {
				for (let dy = -1; dy <= 1; dy++) {
					for (const j of cells.get(`${cx + dx},${cy + dy}`) || []) {
						if (j <= i) continue;
						if (++checked > 64) break neighbors;
						const b = particles[j];
						const distance = Math.hypot(a.x - b.x, a.y - b.y);
						if (distance >= threshold) continue;
						// Only stars at similar depths join, so the network reads as layered space.
						const coplanar = Math.max(0, 1 - Math.abs(a.depth - b.depth) * 2.2);
						const strength = Math.pow(1 - distance / threshold, 1.4) * coplanar * Math.min(a.depth, b.depth);
						if (strength < 0.02) continue;
						const level = Math.min(levels - 1, Math.floor(strength * levels * 1.4));
						paths[level + (a.depth + b.depth > 1.3 ? levels : 0)].push([a.x, a.y, b.x, b.y]);
					}
				}
			}
		}
		for (let index = 0; index < paths.length; index++) {
			if (!paths[index].length) continue;
			const level = index % levels,
				near = index >= levels;
			ctx.strokeStyle = `hsla(${hue + 25}, 80%, ${near ? 78 : 68}%, ${((level + 0.6) / levels) * 0.6 * intensity})`;
			ctx.lineWidth = near ? 0.85 : 0.5;
			ctx.beginPath();
			for (const [ax, ay, bx, by] of paths[index]) {
				ctx.moveTo(ax, ay);
				ctx.lineTo(bx, by);
			}
			ctx.stroke();
		}
	}
	/** Seamless per-star scintillation. @param particle Star. @param i Index. @returns Brightness multiplier. */
	function twinkle(particle: Particle, i: number): number {
		return 0.72 + Math.sin(phase * 3 + i * 1.7 + particle.light * 9) * 0.28 * particle.light;
	}
	if (bloom > 0 && count > 0) {
		// One blurred layer carries the bloom of every in-focus star.
		const halo = ctx.createLinearGradient(0, 0, size.width, size.height);
		halo.addColorStop(0, `hsla(${hue - 10}, 90%, 70%, ${Math.min(1, 0.75 * intensity * bloom)})`);
		halo.addColorStop(1, `hsla(${hue + 60}, 90%, 70%, ${Math.min(1, 0.75 * intensity * bloom)})`);
		ctx.fillStyle = halo;
		ctx.beginPath();
		for (let i = 0; i < count; i++) {
			const p = particles[i],
				blurred = Math.abs(p.depth - focus);
			if (blurred > 0.28 || !p.radius) continue;
			const r = p.radius * (1.6 + p.depth * 1.6) * twinkle(p, i);
			ctx.moveTo(p.x + r, p.y);
			ctx.ellipse(p.x, p.y, r, r, 0, 0, TAU);
		}
		blur(ctx, 3 + 3 * bloom);
		ctx.fill();
		blur(ctx, 0);
	}
	for (let i = 0; i < count; i++) {
		const p = particles[i];
		const defocus = Math.max(0, Math.abs(p.depth - focus) - 0.18);
		const shimmer = twinkle(p, i);
		const near = p.depth > focus;
		// Out-of-focus stars open into soft bokeh discs with a brighter rim, as a real lens renders them.
		if (defocus > 0.07 && near && p.radius > 0) {
			const disc = p.radius * 2 + 2 + defocus * 110;
			const alpha = Math.min(0.5, (0.08 + p.light * 0.14) * intensity * (1 + p.radius * 0.15));
			const saturation = Math.min(100, p.saturation + 25);
			const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, disc);
			gradient.addColorStop(0, `hsla(${p.hue}, ${saturation}%, 66%, ${alpha * 0.5})`);
			gradient.addColorStop(0.8, `hsla(${p.hue}, ${saturation}%, 70%, ${alpha * 0.72})`);
			gradient.addColorStop(0.93, `hsla(${p.hue + 8}, ${saturation}%, 80%, ${alpha})`);
			gradient.addColorStop(1, `hsla(${p.hue}, ${saturation}%, 70%, 0)`);
			ctx.fillStyle = gradient;
			ctx.beginPath();
			ctx.ellipse(p.x, p.y, disc, disc, 0, 0, TAU);
			ctx.fill();
		} else if (bloom > 0 && p.radius > 0 && p.light > 0.3) {
			glow(ctx, p.x, p.y, p.radius * (4 + p.depth * 10) * bloom, `hsla(${p.hue}, 95%, 65%, ${(0.08 + p.depth * 0.18) * intensity * shimmer})`);
		}
		const focused = defocus <= 0.07 || !near;
		const core = Math.min(1, intensity * (0.3 + p.depth * 0.7) * shimmer * (focused ? 1 : 0.35));
		ctx.fillStyle = `hsla(${p.hue}, ${p.saturation}%, ${80 + p.light * 15}%, ${core})`;
		ctx.beginPath();
		ctx.arc(p.x, p.y, p.radius, 0, TAU);
		ctx.fill();
	}
	// Diffraction spikes on the brightest in-focus stars.
	let spiked = 0;
	for (let i = 0; i < count && spiked < 14; i++) {
		const p = particles[i];
		if (p.light < 0.9 || !p.field || Math.abs(p.depth - focus) > 0.2 || p.radius < min + (max - min) * 0.45 || !p.radius) continue;
		spiked++;
		const shimmer = twinkle(p, i);
		spikes(
			ctx,
			p.x,
			p.y,
			p.radius * (9 + p.light * 9) * shimmer,
			Math.max(0.35, p.radius * 0.28),
			`rgba(240, 246, 255, ${0.75 * intensity * shimmer})`,
		);
	}
	ctx.restore();
}
