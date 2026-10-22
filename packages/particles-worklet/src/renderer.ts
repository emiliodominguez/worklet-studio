import { commonProperties, controls, drawable, glow, number, random, TAU, token } from "../../core/src/index.ts";
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
];

/** Render a deterministic constellation, with bounded spatial-neighbor searches. @param ctx Paint context. @param size CSS-pixel dimensions. @param properties CSS inputs. */
export function paint(ctx: PaintContext, size: PaintSize, properties: PaintProperties): void {
	if (!drawable(size)) return;
	const { phase, seed, hue, intensity } = controls(properties);
	const next = random(seed);
	const count = Math.floor(number(properties, "--particles-count", 130, 0, 800));
	const min = number(properties, "--particles-size-min", 0.6, 0, 30);
	const max = number(properties, "--particles-size-max", 2.4, min, 40);
	const threshold = number(properties, "--particles-lines-threshold", 115, 0, 400);
	const drift = number(properties, "--particles-drift", 35, 0, 200);
	const galaxy = token(properties, "--particles-layout", "field") === "galaxy";
	const bloom = number(properties, "--particles-glow", 1, 0, 2);
	ctx.fillStyle = token(properties, "--particles-background", "#111");
	ctx.fillRect(0, 0, size.width, size.height);
	const particles: { x: number; y: number; radius: number; hue: number }[] = [];
	const cells = new Map<string, number[]>();
	const cellSize = Math.max(1, threshold);
	for (let i = 0; i < count; i++) {
		let x = next() * size.width + Math.sin(phase + next() * TAU) * drift;
		let y = next() * size.height + Math.cos(phase + next() * TAU) * drift;
		if (galaxy) {
			const radial = Math.sqrt(Math.max(0, Math.min(1, x / size.width)));
			const angle = ((i % 3) * TAU) / 3 + radial * 4.5 + phase + (y / size.height) * 0.5;
			const extent = Math.min(size.width * 0.43, size.height * 0.65);
			x = size.width / 2 + Math.cos(angle) * radial * extent;
			y = size.height / 2 + Math.sin(angle) * radial * extent * 0.55 + Math.sin(i * 8.3) * drift * 0.2;
		}
		particles.push({ x, y, radius: min + next() * (max - min), hue: hue + next() * 85 });
		const key = `${Math.floor(x / cellSize)},${Math.floor(y / cellSize)}`;
		const bucket = cells.get(key) || [];
		bucket.push(i);
		cells.set(key, bucket);
	}
	ctx.save();
	ctx.globalCompositeOperation = "lighter";
	if (galaxy && count > 0)
		glow(ctx, size.width / 2, size.height / 2, Math.min(size.width, size.height) * 0.35, `hsla(${hue + 40}, 85%, 65%, ${0.15 * intensity})`);
	if (threshold > 0) {
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
						ctx.strokeStyle = `hsla(${(a.hue + b.hue) / 2}, 85%, 72%, ${(1 - distance / threshold) * 0.32 * intensity})`;
						ctx.lineWidth = 0.65;
						ctx.beginPath();
						ctx.moveTo(a.x, a.y);
						ctx.lineTo(b.x, b.y);
						ctx.stroke();
					}
				}
			}
		}
	}
	for (const particle of particles) {
		const { x, y, radius, hue: tint } = particle;
		if (bloom && radius) glow(ctx, x, y, radius * 7 * bloom, `hsla(${tint}, 95%, 65%, ${0.25 * intensity})`);
		ctx.fillStyle = `hsla(${tint}, 90%, 85%, ${Math.min(1, intensity)})`;
		ctx.beginPath();
		ctx.arc(x, y, radius, 0, TAU);
		ctx.fill();
	}
	ctx.restore();
}
