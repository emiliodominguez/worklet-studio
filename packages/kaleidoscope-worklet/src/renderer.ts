import { blur, commonProperties, controls, drawable, number, random, TAU } from "../../core/src/index.ts";
import type { PaintContext, PaintProperties, PaintSize } from "../../core/src/types.ts";
export const inputProperties = [
	...commonProperties,
	"--kaleidoscope-segments",
	"--kaleidoscope-layers",
	"--kaleidoscope-twist",
	"--kaleidoscope-radius",
];

type Kind = "wash" | "shard" | "rod" | "bead";

interface Piece {
	kind: Kind;
	radius: number;
	angle: number;
	size: number;
	spin: number;
	turn: number;
	wobble: number;
	hue: number;
	saturation: number;
	lightness: number;
	corners: number[];
}

interface Glint {
	x: number;
	y: number;
	energy: number;
}

/** Build the seeded contents of the object cell: soft color washes, glass shards, rods, and beads. @param next Seeded random source. @param count Number of pieces around the full chamber. @param hue Base hue. @returns Pieces ordered back to front. */
function chamber(next: () => number, count: number, hue: number): Piece[] {
	const palette = [0, 0, 28, -34, 52, 0, -18, 165];
	const pieces: Piece[] = [];
	for (let i = 0; i < count; i++) {
		const roll = next();
		const kind: Kind = roll < 0.18 ? "wash" : roll < 0.8 ? "shard" : roll < 0.88 ? "rod" : "bead";
		const corners: number[] = [];
		const sides = 3 + Math.floor(next() * 3);
		for (let corner = 0; corner < sides; corner++) corners.push(0.55 + next() * 0.45);
		pieces.push({
			kind,
			radius: Math.sqrt(0.004 + next() * 0.996),
			angle: next() * TAU,
			size:
				kind === "wash"
					? 0.2 + next() * 0.22
					: kind === "shard"
						? 0.09 + next() * 0.15
						: kind === "rod"
							? 0.12 + next() * 0.16
							: 0.03 + next() * 0.035,
			spin: next() * TAU,
			turn: (next() < 0.5 ? -1 : 1) * (1 + Math.floor(next() * 2)),
			wobble: next() * TAU,
			hue: hue + palette[Math.floor(next() * palette.length)] + (next() - 0.5) * 14,
			saturation: 62 + next() * 30,
			lightness: kind === "wash" ? 58 + next() * 16 : 46 + next() * 34,
			corners,
		});
	}
	const order: Kind[] = ["wash", "shard", "rod", "bead"];
	return pieces.sort(function depth(a, b) {
		return order.indexOf(a.kind) - order.indexOf(b.kind);
	});
}

/** Paint a backlit kaleidoscope: tumbling translucent glass mirrored into wedges inside a dark tube with a brushed rim, seams, and bloomed glints. @param ctx Paint context. @param size CSS dimensions. @param properties CSS inputs. */
export function paint(ctx: PaintContext, size: PaintSize, properties: PaintProperties): void {
	if (!drawable(size)) return;
	const { phase, hue, intensity, seed, viewX, viewY } = controls(properties);
	const requested = Math.floor(number(properties, "--kaleidoscope-segments", 12, 4, 24));
	const segments = Math.ceil(requested / 2) * 2;
	const layers = Math.floor(number(properties, "--kaleidoscope-layers", 10, 3, 18));
	const twist = number(properties, "--kaleidoscope-twist", 1.2, 0, 3);
	const scale = Math.min(size.width, size.height);
	const radius = scale * 0.44 * number(properties, "--kaleidoscope-radius", 1, 0.4, 1.4);
	const wedge = TAU / segments;
	const pieces = chamber(random(seed), layers * 26, hue);
	const turn = phase + viewX * 0.6;
	const lightAngle = -2.2 + viewX * 1.4 + viewY * 0.8;
	const cx = size.width * (0.5 + viewX * 0.02),
		cy = size.height * (0.5 + viewY * 0.02);
	const glints: Glint[] = [];
	ctx.save();
	const room = ctx.createRadialGradient(cx, cy, radius * 0.9, cx, cy, Math.hypot(size.width, size.height) * 0.6);
	room.addColorStop(0, `hsl(${hue}, 30%, 7%)`);
	room.addColorStop(1, `hsl(${hue}, 25%, 2.5%)`);
	ctx.fillStyle = room;
	ctx.fillRect(0, 0, size.width, size.height);
	const halo = ctx.createRadialGradient(cx, cy, radius, cx, cy, radius * 1.5);
	halo.addColorStop(0, `hsla(${hue + 20}, 70%, 55%, ${0.12 * intensity})`);
	halo.addColorStop(1, `hsla(${hue}, 70%, 40%, 0)`);
	ctx.globalCompositeOperation = "lighter";
	ctx.fillStyle = halo;
	ctx.fillRect(cx - radius * 1.5, cy - radius * 1.5, radius * 3, radius * 3);
	ctx.globalCompositeOperation = "source-over";

	ctx.translate(cx, cy);
	ctx.beginPath();
	ctx.arc(0, 0, radius, 0, TAU);
	ctx.save();
	ctx.clip();
	const diffuser = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
	const exposure = Math.min(1.6, intensity);
	diffuser.addColorStop(0, `hsl(${hue + 40}, 45%, ${Math.min(97, 78 + exposure * 14)}%)`);
	diffuser.addColorStop(0.55, `hsl(${hue + 15}, 55%, ${48 + exposure * 22}%)`);
	diffuser.addColorStop(1, `hsl(${hue}, 60%, ${16 + exposure * 14}%)`);
	ctx.fillStyle = diffuser;
	ctx.fillRect(-radius, -radius, radius * 2, radius * 2);

	const visible: { piece: Piece; x: number; y: number; rotation: number; reach: number }[] = [];
	for (const piece of pieces) {
		const r = Math.min(1.08, piece.radius + Math.sin(phase * 2 + piece.wobble) * 0.05) * radius;
		const a = piece.angle + turn + twist * 0.3 * Math.sin(phase + piece.radius * 5 + piece.wobble);
		const reach = (piece.kind === "rod" ? piece.size * 0.55 : piece.size) * radius;
		const local = ((a % TAU) + TAU) % TAU;
		const margin = Math.asin(Math.min(1, reach / Math.max(reach, r)));
		if (local > wedge + margin && local < TAU - margin) continue;
		visible.push({ piece, x: Math.cos(a) * r, y: Math.sin(a) * r, rotation: piece.spin + phase * piece.turn * (0.4 + twist * 0.4), reach });
	}

	for (let sector = 0; sector < segments; sector++) {
		ctx.save();
		if (sector % 2) {
			ctx.rotate((sector + 1) * wedge);
			ctx.scale(1, -1);
		} else ctx.rotate(sector * wedge);
		ctx.beginPath();
		ctx.moveTo(0, 0);
		ctx.arc(0, 0, radius * 1.01, -0.004, wedge + 0.004);
		ctx.closePath();
		ctx.clip();
		for (const { piece, x, y, rotation, reach } of visible) {
			const color = `hsl(${piece.hue}, ${piece.saturation}%, ${piece.lightness}%)`;
			const deep = `hsl(${piece.hue + 8}, ${Math.min(100, piece.saturation + 10)}%, ${piece.lightness * 0.62}%)`;
			ctx.globalCompositeOperation = "multiply";
			if (piece.kind === "wash") {
				const wash = ctx.createRadialGradient(x, y, 0, x, y, reach);
				wash.addColorStop(0, color);
				wash.addColorStop(1, `hsla(${piece.hue}, ${piece.saturation}%, ${piece.lightness}%, 0)`);
				ctx.fillStyle = wash;
				ctx.fillRect(x - reach, y - reach, reach * 2, reach * 2);
				continue;
			}
			if (piece.kind === "bead") {
				const body = ctx.createRadialGradient(x - reach * 0.25, y - reach * 0.25, 0, x, y, reach);
				body.addColorStop(0, color);
				body.addColorStop(0.75, deep);
				body.addColorStop(1, `hsl(${piece.hue}, 70%, 10%)`);
				ctx.fillStyle = body;
				ctx.beginPath();
				ctx.arc(x, y, reach, 0, TAU);
				ctx.fill();
				ctx.globalCompositeOperation = "lighter";
				const focus = ctx.createRadialGradient(x + reach * 0.3, y + reach * 0.3, 0, x + reach * 0.3, y + reach * 0.3, reach * 0.55);
				focus.addColorStop(0, `hsla(${piece.hue + 20}, 90%, 80%, 0.55)`);
				focus.addColorStop(1, `hsla(${piece.hue}, 90%, 60%, 0)`);
				ctx.fillStyle = focus;
				ctx.fillRect(x - reach, y - reach, reach * 2, reach * 2);
				if (!sector) glints.push({ x: x + Math.cos(lightAngle) * reach * 0.55, y: y + Math.sin(lightAngle) * reach * 0.55, energy: 0.55 });
				continue;
			}
			ctx.beginPath();
			if (piece.kind === "rod") {
				const dx = Math.cos(rotation) * reach,
					dy = Math.sin(rotation) * reach;
				ctx.moveTo(x - dx, y - dy);
				ctx.lineTo(x + dx, y + dy);
				ctx.lineCap = "round";
				ctx.lineWidth = Math.max(1.5, radius * 0.022);
				ctx.strokeStyle = deep;
				ctx.stroke();
				ctx.globalCompositeOperation = "lighter";
				ctx.lineWidth = Math.max(0.6, radius * 0.005);
				ctx.strokeStyle = `hsla(${piece.hue + 25}, 80%, 82%, 0.5)`;
				ctx.stroke();
				const shine = Math.pow(Math.max(0, Math.cos(rotation - lightAngle + Math.PI / 2)), 14);
				if (!sector && shine > 0.25) glints.push({ x: x + dx * 0.4, y: y + dy * 0.4, energy: shine });
				continue;
			}
			const sides = piece.corners.length;
			let brightest = -1,
				gx = x,
				gy = y;
			for (let corner = 0; corner < sides; corner++) {
				const angle = rotation + (corner / sides) * TAU,
					distance = reach * piece.corners[corner];
				const px = x + Math.cos(angle) * distance,
					py = y + Math.sin(angle) * distance;
				if (corner) ctx.lineTo(px, py);
				else ctx.moveTo(px, py);
				const facing = Math.cos(angle - lightAngle);
				if (facing > brightest) {
					brightest = facing;
					gx = px;
					gy = py;
				}
			}
			ctx.closePath();
			const across = ctx.createLinearGradient(
				x - Math.cos(lightAngle) * reach,
				y - Math.sin(lightAngle) * reach,
				x + Math.cos(lightAngle) * reach,
				y + Math.sin(lightAngle) * reach,
			);
			across.addColorStop(0, deep);
			across.addColorStop(0.6, color);
			across.addColorStop(1, `hsl(${piece.hue - 6}, ${piece.saturation}%, ${Math.min(92, piece.lightness + 22)}%)`);
			ctx.fillStyle = across;
			ctx.fill();
			ctx.globalCompositeOperation = "lighter";
			const sheen = ctx.createLinearGradient(
				x - Math.cos(lightAngle) * reach,
				y - Math.sin(lightAngle) * reach,
				x + Math.cos(lightAngle) * reach,
				y + Math.sin(lightAngle) * reach,
			);
			sheen.addColorStop(0, "rgba(255,255,255,0)");
			sheen.addColorStop(0.62, "rgba(255,255,255,0)");
			sheen.addColorStop(0.8, `hsla(${piece.hue + 30}, 90%, 85%, 0.2)`);
			sheen.addColorStop(0.9, "rgba(255,255,255,0.04)");
			sheen.addColorStop(1, "rgba(255,255,255,0)");
			ctx.fillStyle = sheen;
			ctx.fill();
			ctx.globalCompositeOperation = "multiply";
			ctx.lineJoin = "round";
			ctx.lineWidth = Math.max(1, radius * 0.006);
			ctx.strokeStyle = `hsla(${piece.hue}, 60%, 16%, 0.45)`;
			ctx.stroke();
			ctx.globalCompositeOperation = "lighter";
			ctx.lineWidth = Math.max(0.5, radius * 0.0022);
			ctx.strokeStyle = `hsla(${piece.hue + 20}, 80%, 80%, 0.35)`;
			ctx.stroke();
			const shine = Math.pow(Math.max(0, Math.cos(rotation * 2 - lightAngle)), 10);
			if (!sector && shine > 0.35) glints.push({ x: gx, y: gy, energy: shine });
		}
		ctx.restore();
	}
	ctx.globalCompositeOperation = "source-over";

	const seams = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
	seams.addColorStop(0, `hsla(${hue + 40}, 80%, 92%, ${0.4 * intensity})`);
	seams.addColorStop(1, `hsla(${hue + 20}, 80%, 80%, ${0.08 * intensity})`);
	ctx.globalCompositeOperation = "lighter";
	ctx.strokeStyle = seams;
	ctx.lineWidth = Math.max(0.5, radius * 0.0018);
	ctx.beginPath();
	for (let sector = 0; sector < segments; sector++) {
		ctx.moveTo(0, 0);
		ctx.lineTo(Math.cos(sector * wedge) * radius, Math.sin(sector * wedge) * radius);
	}
	ctx.stroke();
	const core = ctx.createRadialGradient(0, 0, 0, 0, 0, radius * 0.12);
	core.addColorStop(0, `hsla(${hue + 45}, 70%, 92%, ${0.3 * intensity})`);
	core.addColorStop(1, `hsla(${hue + 30}, 80%, 70%, 0)`);
	ctx.fillStyle = core;
	ctx.fillRect(-radius * 0.12, -radius * 0.12, radius * 0.24, radius * 0.24);
	ctx.globalCompositeOperation = "source-over";
	const vignette = ctx.createRadialGradient(0, 0, radius * 0.55, 0, 0, radius);
	vignette.addColorStop(0, "rgba(0,0,0,0)");
	vignette.addColorStop(0.75, "rgba(0,0,0,0.22)");
	vignette.addColorStop(1, "rgba(0,0,0,0.8)");
	ctx.fillStyle = vignette;
	ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
	ctx.restore();

	const points: Glint[] = [];
	for (const glint of glints) {
		const angle = Math.atan2(glint.y, glint.x),
			distance = Math.hypot(glint.x, glint.y);
		if (angle < 0 || angle > wedge || distance > radius * 0.97) continue;
		for (let sector = 0; sector < segments; sector++) {
			const mirrored = sector % 2 ? (sector + 1) * wedge - angle : sector * wedge + angle;
			points.push({ x: Math.cos(mirrored) * distance, y: Math.sin(mirrored) * distance, energy: glint.energy });
		}
	}
	ctx.globalCompositeOperation = "lighter";
	if (points.length) {
		ctx.save();
		blur(ctx, Math.max(1, radius * 0.018));
		ctx.fillStyle = `hsla(${hue + 30}, 80%, 75%, ${0.5 * intensity})`;
		ctx.beginPath();
		for (const point of points) {
			const glow = radius * 0.03 * (0.5 + point.energy);
			ctx.moveTo(point.x + glow, point.y);
			ctx.arc(point.x, point.y, glow, 0, TAU);
		}
		ctx.fill();
		ctx.restore();
		ctx.fillStyle = `rgba(255, 252, 245, ${Math.min(1, 0.85 * intensity)})`;
		ctx.strokeStyle = `rgba(255, 250, 240, ${Math.min(1, 0.5 * intensity)})`;
		ctx.lineWidth = Math.max(0.5, radius * 0.0018);
		ctx.beginPath();
		for (const point of points) {
			const dot = Math.max(0.6, radius * 0.0045 * (0.5 + point.energy));
			ctx.moveTo(point.x + dot, point.y);
			ctx.arc(point.x, point.y, dot, 0, TAU);
		}
		ctx.fill();
		ctx.beginPath();
		for (const point of points) {
			if (point.energy < 0.7) continue;
			const ray = radius * 0.05 * point.energy;
			ctx.moveTo(point.x - ray, point.y);
			ctx.lineTo(point.x + ray, point.y);
			ctx.moveTo(point.x, point.y - ray);
			ctx.lineTo(point.x, point.y + ray);
		}
		ctx.stroke();
	}
	ctx.globalCompositeOperation = "source-over";

	const metal = ctx.createConicGradient(lightAngle, 0, 0);
	for (let stop = 0; stop <= 16; stop++) {
		const sheen = 0.5 + 0.5 * Math.cos((stop / 16) * TAU * 2);
		metal.addColorStop(stop / 16, `hsl(${hue + 20}, 12%, ${10 + sheen * sheen * 38}%)`);
	}
	ctx.strokeStyle = metal;
	ctx.lineWidth = radius * 0.05;
	ctx.beginPath();
	ctx.arc(0, 0, radius * 1.025, 0, TAU);
	ctx.stroke();
	ctx.strokeStyle = "rgba(0, 0, 0, 0.6)";
	ctx.lineWidth = Math.max(1, radius * 0.006);
	ctx.beginPath();
	ctx.arc(0, 0, radius * 1.002, 0, TAU);
	ctx.stroke();
	ctx.strokeStyle = `hsla(${hue + 30}, 30%, 85%, ${0.35 * intensity})`;
	ctx.lineWidth = Math.max(0.5, radius * 0.0025);
	ctx.beginPath();
	ctx.arc(0, 0, radius * 1.05, 0, TAU);
	ctx.stroke();
	ctx.restore();
}
