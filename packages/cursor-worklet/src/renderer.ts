import { blur, color, commonProperties, controls, drawable, glow, number, TAU, token } from "../../core/src/index.ts";
import { noise } from "../../core/src/noise.ts";
import { material } from "../../core/src/surface.ts";
import type { PaintContext, PaintSize, PaintProperties } from "../../core/src/types.ts";
import { parseTrail, resampleTrail, smoothTrail } from "./trails.ts";
import type { TrailPoint } from "./trails.ts";

export const inputProperties = [
	...commonProperties,
	"--cursor-ripples",
	"--cursor-size",
	"--cursor-border-size",
	"--cursor-fill-color",
	"--cursor-stroke-color",
	"--cursor-color-intensity",
	"--cursor-position-x",
	"--cursor-position-y",
	"--cursor-mode",
	"--cursor-orbit",
	"--cursor-glow",
	"--cursor-trail",
	"--cursor-press",
	"--cursor-twist",
	"--cursor-speed",
	"--cursor-heading",
];

/** Trace a polyline into the current path. @param ctx Paint context. @param points Ordered points. */
function polyline(ctx: PaintContext, points: TrailPoint[]): void {
	for (let i = 0; i < points.length; i++) {
		if (i) ctx.lineTo(points[i].x, points[i].y);
		else ctx.moveTo(points[i].x, points[i].y);
	}
}

/** Offset a trail sideways by a width profile, producing a closed tapered silhouette. @param ctx Paint context. @param points Trail, head first. @param width Half-width for a fraction along the trail. */
function outline(ctx: PaintContext, points: TrailPoint[], width: (u: number) => number): void {
	const left: TrailPoint[] = [],
		right: TrailPoint[] = [];
	for (let i = 0; i < points.length; i++) {
		const a = points[Math.max(0, i - 1)],
			b = points[Math.min(points.length - 1, i + 1)];
		const dx = b.x - a.x,
			dy = b.y - a.y,
			length = Math.hypot(dx, dy) || 1;
		const w = width(i / (points.length - 1));
		left.push({ x: points[i].x - (dy / length) * w, y: points[i].y + (dx / length) * w });
		right.push({ x: points[i].x + (dy / length) * w, y: points[i].y - (dx / length) * w });
	}
	ctx.beginPath();
	polyline(ctx, left);
	for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i].x, right[i].y);
	ctx.closePath();
}

/** Linear gradient from a trail's head to its tail. @param ctx Paint context. @param points Trail, head first. @param stops Offset and color pairs. @returns Gradient. */
function along(ctx: PaintContext, points: TrailPoint[], stops: [number, string][]): CanvasGradient {
	const head = points[0],
		tail = points[points.length - 1];
	const gradient = ctx.createLinearGradient(head.x, head.y, tail.x + 0.01, tail.y + 0.01);
	for (const [offset, value] of stops) gradient.addColorStop(offset, value);
	return gradient;
}

/** Paint an incandescent point: a wide halo, a blurred core, and a white-hot center. @param ctx Paint context. @param x Center x. @param y Center y. @param radius Core radius. @param hue Hue. @param opacity Exposure. @param bloom Halo scale. */
function hotspot(ctx: PaintContext, x: number, y: number, radius: number, hue: number, opacity: number, bloom: number): void {
	glow(ctx, x, y, radius * 9 * bloom, `hsla(${hue}, 95%, 55%, ${opacity * 0.22})`);
	glow(ctx, x, y, radius * 3.5, `hsla(${hue + 15}, 100%, 72%, ${opacity * 0.7})`);
	const core = ctx.createRadialGradient(x, y, 0, x, y, radius * 1.2);
	core.addColorStop(0, `rgba(255, 255, 255, ${Math.min(1, opacity * 1.1)})`);
	core.addColorStop(0.45, `rgba(255, 250, 240, ${Math.min(1, opacity)})`);
	core.addColorStop(1, `hsla(${hue + 20}, 100%, 75%, 0)`);
	ctx.fillStyle = core;
	ctx.beginPath();
	ctx.arc(x, y, radius * 1.2, 0, TAU);
	ctx.fill();
}

/** Hermite smoothstep. @param edge0 Lower edge. @param edge1 Upper edge. @param value Input. @returns Eased 0–1 value. */
function smoothstep(edge0: number, edge1: number, value: number): number {
	const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
	return t * t * (3 - 2 * t);
}

/** Number of evenly spaced control points shared by the live trail and the idle wisp, so they can blend point for point. */
const TRAIL_POINTS = 24;

/** Read the pointer trail and blend it continuously into an animated idle wisp as it reels in. The wisp streams behind the last direction of travel, so a settling trail relaxes into it instead of popping to a fixed pose. @param properties CSS inputs. @param x Head x. @param y Head y. @param radius Cursor radius. @param phase Loop phase. @returns Smoothed trail, head first. */
function trail(properties: PaintProperties, x: number, y: number, radius: number, phase: number): TrailPoint[] {
	const history = parseTrail(token(properties, "--cursor-trail", ""));
	const live = resampleTrail(history.length ? history : [{ x, y }], TRAIL_POINTS);
	let length = 0;
	for (let i = 1; i < history.length; i++) length += Math.hypot(history[i].x - history[i - 1].x, history[i].y - history[i - 1].y);
	// Crossfade around the idle tail's own length, so the visible length stays nearly constant while the trail reels in.
	const idle = radius * 7;
	const rest = 1 - smoothstep(idle * 0.4, idle * 1.2, length);
	if (rest <= 0) return smoothTrail(live);
	const heading = number(properties, "--cursor-heading", 0, -100, 100);
	const backX = -Math.cos(heading),
		backY = -Math.sin(heading);
	const breath = 1 + Math.sin(phase) * 0.08;
	const points: TrailPoint[] = [];
	for (let i = 0; i < TRAIL_POINTS; i++) {
		const u = i / (TRAIL_POINTS - 1);
		const reach = u * idle * breath,
			sway = Math.sin(u * 5 - phase) * radius * 1.4 * Math.sin((u * Math.PI) / 2);
		const wispX = x + backX * reach - backY * sway,
			wispY = y + backY * reach + backX * sway;
		points.push({ x: live[i].x + (wispX - live[i].x) * rest, y: live[i].y + (wispY - live[i].y) * rest });
	}
	return smoothTrail(points);
}

/** Paint twisting silk with a bloom underlayer, a satin body, iridescent threads, and a hot leading point. */
function silk(
	ctx: PaintContext,
	points: TrailPoint[],
	x: number,
	y: number,
	radius: number,
	hue: number,
	phase: number,
	opacity: number,
	bloom: number,
	twist: number,
	rings: number,
	speed: number,
): void {
	ctx.save();
	blur(ctx, radius * 0.55);
	ctx.strokeStyle = along(ctx, points, [
		[0, `hsla(${hue}, 95%, 62%, ${opacity * 0.5 * bloom})`],
		[0.6, `hsla(${hue + 40}, 90%, 55%, ${opacity * 0.22 * bloom})`],
		[1, `hsla(${hue + 60}, 90%, 50%, 0)`],
	]);
	ctx.lineWidth = radius * 1.3;
	ctx.beginPath();
	polyline(ctx, points);
	ctx.stroke();
	ctx.restore();
	ctx.globalCompositeOperation = "source-over";
	for (let i = points.length - 1; i > 0; i--) {
		const u = i / points.length,
			point = points[i],
			previous = points[i - 1];
		const roll = u * TAU * twist + phase;
		const facing = Math.cos(roll);
		ctx.strokeStyle = material(
			Math.sin(roll) * 0.8,
			-0.35,
			Math.sqrt(Math.max(0.01, 0.88 - Math.sin(roll) ** 2 * 0.64)),
			hue + u * 55,
			opacity * 1.05,
			1,
		);
		ctx.lineWidth = Math.max(0.3, Math.sin(Math.PI * (0.08 + u * 0.92)) * radius * (0.16 + Math.abs(facing) * 0.64));
		ctx.globalAlpha = Math.pow(1 - u, 0.7);
		ctx.beginPath();
		ctx.moveTo(previous.x, previous.y);
		ctx.lineTo(point.x, point.y);
		ctx.stroke();
	}
	ctx.globalAlpha = 1;
	ctx.globalCompositeOperation = "lighter";
	const strands = Math.max(4, Math.min(18, rings * 2));
	for (let strand = 0; strand < strands; strand++) {
		const offset = strand / (strands - 1) - 0.5,
			path: TrailPoint[] = [];
		for (let i = 0; i < points.length; i++) {
			const u = i / (points.length - 1),
				point = points[i],
				next = points[Math.min(i + 1, points.length - 1)],
				back = points[Math.max(i - 1, 0)];
			const dx = next.x - back.x,
				dy = next.y - back.y,
				length = Math.hypot(dx, dy) || 1;
			const spread = Math.sin(Math.min(1, u * 1.6) * Math.PI * 0.5) * (1 - u * 0.3) * radius * (1.2 + speed * 0.025);
			const wave = offset * spread * Math.sin(u * TAU * twist + phase + offset * 1.5);
			path.push({ x: point.x - (dy / length) * wave, y: point.y + (dx / length) * wave });
		}
		ctx.strokeStyle = along(ctx, path, [
			[0, `hsla(${hue + offset * 95}, 95%, 82%, ${Math.min(1, opacity * 0.85)})`],
			[0.5, `hsla(${hue + offset * 95 + 25}, 95%, 70%, ${opacity * 0.45})`],
			[1, `hsla(${hue + offset * 95 + 45}, 95%, 65%, 0)`],
		]);
		ctx.lineWidth = strand % 5 === 0 ? 1.1 : 0.6;
		ctx.beginPath();
		polyline(ctx, path);
		ctx.stroke();
	}
	hotspot(ctx, x, y, Math.max(1, radius * 0.09), hue, opacity, bloom);
}

/** Paint a comet: a curved dust tail widening behind the head, fine ion streaks, scattered grains, and an incandescent coma. */
function comet(
	ctx: PaintContext,
	points: TrailPoint[],
	x: number,
	y: number,
	radius: number,
	hue: number,
	phase: number,
	opacity: number,
	bloom: number,
): void {
	ctx.save();
	blur(ctx, radius * 0.45);
	ctx.fillStyle = along(ctx, points, [
		[0, `hsla(${hue + 10}, 100%, 70%, ${opacity * 0.75})`],
		[0.35, `hsla(${hue + 25}, 90%, 55%, ${opacity * 0.32})`],
		[1, `hsla(${hue + 40}, 80%, 45%, 0)`],
	]);
	outline(ctx, points, function dust(u) {
		return radius * (0.3 + Math.pow(u, 0.8) * 1.5);
	});
	ctx.fill();
	ctx.restore();
	ctx.save();
	blur(ctx, 1.2);
	ctx.strokeStyle = along(ctx, points, [
		[0, `hsla(${hue + 180}, 90%, 85%, ${opacity * 0.6})`],
		[0.7, `hsla(${hue + 200}, 90%, 70%, ${opacity * 0.18})`],
		[1, `hsla(${hue + 210}, 90%, 65%, 0)`],
	]);
	ctx.lineWidth = 0.8;
	ctx.beginPath();
	for (let streak = -2; streak <= 2; streak++) {
		const path: TrailPoint[] = [];
		for (let i = 0; i < points.length; i++) {
			const u = i / (points.length - 1),
				a = points[Math.max(0, i - 1)],
				b = points[Math.min(points.length - 1, i + 1)];
			const dx = b.x - a.x,
				dy = b.y - a.y,
				length = Math.hypot(dx, dy) || 1;
			const offset = streak * radius * 0.16 * u * (1 + Math.sin(phase * 2 + streak) * 0.25);
			path.push({ x: points[i].x - (dy / length) * offset, y: points[i].y + (dx / length) * offset });
		}
		polyline(ctx, path);
	}
	ctx.stroke();
	ctx.restore();
	ctx.fillStyle = along(ctx, points, [
		[0, `rgba(255, 252, 240, ${Math.min(1, opacity)})`],
		[0.25, `hsla(${hue + 20}, 100%, 75%, ${opacity * 0.7})`],
		[1, `hsla(${hue + 40}, 100%, 60%, 0)`],
	]);
	outline(ctx, points, function core(u) {
		return Math.max(0.2, radius * 0.2 * Math.pow(1 - u, 1.4));
	});
	ctx.fill();
	ctx.fillStyle = `hsla(${hue + 30}, 100%, 85%, ${opacity * 0.85})`;
	ctx.beginPath();
	for (let grain = 0; grain < 46; grain++) {
		const position = (grain * 0.618034 + 0.13) % 1,
			index = Math.min(points.length - 1, Math.floor(position * points.length));
		const point = points[index],
			u = index / (points.length - 1);
		const drift = Math.sin(grain * 12.7 + phase) * radius * (0.2 + u * 1.3),
			lift = Math.cos(grain * 7.3 - phase) * radius * (0.15 + u * 0.9);
		const size = Math.max(0.2, (0.4 + ((grain * 37) % 10) * 0.09) * (1 - u));
		ctx.moveTo(point.x + drift + size, point.y + lift);
		ctx.arc(point.x + drift, point.y + lift, size, 0, TAU);
	}
	ctx.fill();
	glow(ctx, x, y, radius * 2.4 * bloom, `hsla(${hue + 15}, 100%, 65%, ${opacity * 0.35})`);
	hotspot(ctx, x, y, Math.max(1, radius * 0.15), hue, opacity, bloom * 0.6);
}

/** Paint a plasma globe: a glass sphere, a glowing electrode, and branching filaments that reach for the glass and gather under a press. */
function plasma(
	ctx: PaintContext,
	x: number,
	y: number,
	radius: number,
	hue: number,
	phase: number,
	opacity: number,
	bloom: number,
	twist: number,
	press: number,
	seed: number,
): void {
	const body = ctx.createRadialGradient(x, y, 0, x, y, radius);
	body.addColorStop(0, `hsla(${hue}, 80%, 30%, ${opacity * 0.35})`);
	body.addColorStop(0.75, `hsla(${hue + 20}, 70%, 12%, ${opacity * 0.22})`);
	body.addColorStop(0.95, `hsla(${hue + 30}, 80%, 45%, ${opacity * 0.32})`);
	body.addColorStop(1, `hsla(${hue + 30}, 90%, 70%, 0)`);
	ctx.fillStyle = body;
	ctx.beginPath();
	ctx.arc(x, y, radius, 0, TAU);
	ctx.fill();
	const branches: TrailPoint[][] = [],
		contacts: TrailPoint[] = [];
	const count = 7 + Math.round(twist * 2);
	const focus = -Math.PI * 0.7;
	for (let filament = 0; filament < count; filament++) {
		const drift = noise(filament * 1.7 + Math.cos(phase) * 0.9, Math.sin(phase) * 0.9, seed + 5) * 1.6;
		let angle = (filament / count) * TAU + drift + Math.sin(phase + filament * 2.4) * 0.55;
		angle += Math.atan2(Math.sin(focus - angle), Math.cos(focus - angle)) * press * 0.85;
		const path: TrailPoint[] = [];
		for (let step = 0; step <= 22; step++) {
			const u = step / 22,
				r = radius * (0.12 + u * 0.86);
			const jag = noise(u * 3.2 + filament * 3.1, Math.cos(phase + filament) * 1.6, seed + filament) * 0.24 * twist;
			const bend = Math.sin(u * Math.PI) * (jag + Math.sin(u * 3 + phase * 2 + filament) * 0.12);
			path.push({ x: x + Math.cos(angle + bend) * r, y: y + Math.sin(angle + bend) * r });
		}
		branches.push(path);
		contacts.push(path[path.length - 1]);
		if (filament % 2 === 0) {
			const root = path[11],
				fork: TrailPoint[] = [root];
			const side = filament % 4 ? 1 : -1;
			for (let step = 1; step <= 8; step++) {
				const u = step / 8,
					r = radius * (0.12 + (0.5 + u * 0.4) * 0.86);
				const wobble = noise(u * 3 + filament, Math.sin(phase + filament) * 1.4, seed + 41) * 0.18;
				fork.push({ x: x + Math.cos(angle + side * u * 0.45 + wobble) * r, y: y + Math.sin(angle + side * u * 0.45 + wobble) * r });
			}
			branches.push(fork);
		}
	}
	ctx.save();
	blur(ctx, Math.max(1, radius * 0.08));
	ctx.strokeStyle = `hsla(${hue}, 100%, 62%, ${opacity * 0.95})`;
	ctx.lineWidth = Math.max(1, radius * 0.1);
	ctx.beginPath();
	for (const path of branches) polyline(ctx, path);
	ctx.stroke();
	ctx.restore();
	ctx.strokeStyle = `hsla(${hue + 20}, 100%, 88%, ${Math.min(1, opacity * 1.1)})`;
	ctx.lineWidth = Math.max(0.6, radius * 0.016);
	ctx.beginPath();
	for (const path of branches) polyline(ctx, path);
	ctx.stroke();
	for (const contact of contacts) glow(ctx, contact.x, contact.y, radius * 0.16, `hsla(${hue + 10}, 100%, 80%, ${opacity * 0.6})`);
	glow(ctx, x, y, radius * 0.45, `hsla(${hue + 10}, 100%, 70%, ${opacity * 0.5})`);
	hotspot(ctx, x, y, radius * 0.07, hue, opacity, bloom * 0.8);
	const rim = ctx.createRadialGradient(x, y, radius * 0.86, x, y, radius);
	rim.addColorStop(0, `hsla(${hue + 30}, 80%, 70%, 0)`);
	rim.addColorStop(0.8, `hsla(${hue + 30}, 80%, 75%, ${opacity * 0.22})`);
	rim.addColorStop(1, `hsla(${hue + 30}, 80%, 85%, 0)`);
	ctx.fillStyle = rim;
	ctx.beginPath();
	ctx.arc(x, y, radius, 0, TAU);
	ctx.fill();
	ctx.save();
	blur(ctx, Math.max(0.5, radius * 0.03));
	ctx.strokeStyle = `rgba(255, 255, 255, ${opacity * 0.55})`;
	ctx.lineWidth = Math.max(0.8, radius * 0.05);
	ctx.beginPath();
	ctx.arc(x, y, radius * 0.86, Math.PI * 1.08, Math.PI * 1.42);
	ctx.stroke();
	ctx.restore();
	glow(ctx, x - radius * 0.42, y - radius * 0.5, radius * 0.12, `rgba(255, 255, 255, ${opacity * 0.8})`);
}

/** Paint a glass sphere: Fresnel rim, softbox reflection, a focused refraction crescent, and dispersive fringes. */
function lens(
	ctx: PaintContext,
	x: number,
	y: number,
	radius: number,
	hue: number,
	phase: number,
	opacity: number,
	bloom: number,
	width: number,
): void {
	const sway = Math.sin(phase) * 0.12;
	ctx.globalCompositeOperation = "source-over";
	const body = ctx.createRadialGradient(x - radius * 0.25, y - radius * 0.3, radius * 0.1, x, y, radius);
	body.addColorStop(0, `hsla(${hue}, 50%, 40%, ${opacity * 0.14})`);
	body.addColorStop(0.7, `hsla(${hue + 10}, 60%, 18%, ${opacity * 0.3})`);
	body.addColorStop(0.9, `hsla(${hue + 20}, 70%, 40%, ${opacity * 0.45})`);
	body.addColorStop(1, `hsla(${hue + 30}, 90%, 85%, ${opacity * 0.9})`);
	ctx.fillStyle = body;
	ctx.beginPath();
	ctx.arc(x, y, radius, 0, TAU);
	ctx.fill();
	ctx.globalCompositeOperation = "lighter";
	ctx.save();
	blur(ctx, radius * 0.035);
	ctx.strokeStyle = `hsla(${hue + 10}, 60%, 80%, ${opacity * 0.22})`;
	ctx.lineWidth = radius * 0.07;
	ctx.beginPath();
	ctx.ellipse(x, y - radius * 0.08, radius * 0.88, radius * (0.32 + sway * 0.4), 0, Math.PI * 0.08, Math.PI * 0.92);
	ctx.stroke();
	ctx.restore();
	ctx.save();
	blur(ctx, radius * 0.07);
	const crescent = ctx.createRadialGradient(x + radius * 0.2, y + radius * 0.5, 0, x + radius * 0.2, y + radius * 0.5, radius * 0.6);
	crescent.addColorStop(0, `hsla(${hue + 15}, 90%, 88%, ${Math.min(1, opacity * 1.2)})`);
	crescent.addColorStop(0.5, `hsla(${hue + 35}, 90%, 62%, ${opacity * 0.6})`);
	crescent.addColorStop(1, `hsla(${hue + 50}, 90%, 50%, 0)`);
	ctx.fillStyle = crescent;
	ctx.beginPath();
	ctx.arc(x, y, radius * 0.86, Math.PI * (0.08 + sway * 0.3), Math.PI * (0.92 + sway * 0.3));
	ctx.arc(x + radius * 0.08, y + radius * 0.02, radius * 0.66, Math.PI * (0.88 + sway * 0.3), Math.PI * (0.12 + sway * 0.3), true);
	ctx.closePath();
	ctx.fill();
	ctx.restore();
	ctx.save();
	blur(ctx, Math.max(0.6, radius * 0.025));
	ctx.translate(x - radius * (0.36 - sway * 0.3), y - radius * 0.44);
	ctx.rotate(-0.62 + sway);
	const box = ctx.createLinearGradient(0, -radius * 0.17, 0, radius * 0.17);
	box.addColorStop(0, `rgba(255, 255, 255, ${opacity * 0.95})`);
	box.addColorStop(1, `rgba(220, 235, 255, ${opacity * 0.12})`);
	ctx.fillStyle = box;
	ctx.beginPath();
	ctx.ellipse(0, 0, radius * 0.3, radius * 0.15, 0, 0, TAU);
	ctx.fill();
	ctx.restore();
	glow(ctx, x + radius * 0.48, y + radius * 0.42, radius * 0.1, `rgba(255, 255, 255, ${opacity * 0.6})`);
	const channels = ["255, 70, 110", "90, 255, 150", "90, 140, 255"];
	ctx.lineWidth = Math.max(0.8, width * 1.3);
	for (let channel = 0; channel < 3; channel++) {
		const shift = (channel - 1) * radius * 0.018;
		ctx.strokeStyle = `rgba(${channels[channel]}, ${opacity * 0.55})`;
		ctx.beginPath();
		ctx.arc(x + shift * 0.6, y + shift, radius * (1 + (channel - 1) * 0.012), 0, TAU);
		ctx.stroke();
	}
	glow(ctx, x, y, radius * 1.6 * bloom, `hsla(${hue}, 80%, 60%, ${opacity * 0.1})`);
}

/** Paint an atom: a glossy nucleus and electrons with comet-like orbital streaks, occluded behind the nucleus. */
function atom(
	ctx: PaintContext,
	x: number,
	y: number,
	radius: number,
	hue: number,
	phase: number,
	opacity: number,
	bloom: number,
	width: number,
	rings: number,
	orbit: number,
): void {
	const electrons: { x: number; y: number; front: boolean; depth: number; hue: number }[] = [];
	/** Stroke one half of every orbit with a conic gradient that brightens toward each electron. @param front Whether to draw the near half. */
	function orbits(front: boolean): void {
		for (let ring = 0; ring < rings; ring++) {
			const r = radius * (1.3 + ring * 0.5) * orbit,
				squash = 0.25 + 0.15 * Math.sin(phase + ring);
			const tilt = phase + ring * 0.7,
				a = phase * 2 + ring * 1.7;
			ctx.save();
			ctx.translate(x, y);
			ctx.rotate(tilt);
			ctx.scale(1, squash);
			const streak = ctx.createConicGradient(a, 0, 0);
			streak.addColorStop(0, `hsla(${hue + ring * 18}, 90%, 70%, ${opacity * 0.14})`);
			streak.addColorStop(0.7, `hsla(${hue + ring * 18}, 90%, 72%, ${opacity * 0.32})`);
			streak.addColorStop(0.97, `hsla(${hue + ring * 18}, 100%, 85%, ${Math.min(1, opacity * 1.1)})`);
			streak.addColorStop(1, `hsla(${hue + ring * 18}, 100%, 85%, ${opacity * 0.08})`);
			ctx.strokeStyle = streak;
			ctx.lineWidth = Math.max(0.6, width) * 1.4;
			ctx.beginPath();
			ctx.arc(0, 0, r, front ? 0 : Math.PI, front ? Math.PI : TAU);
			ctx.stroke();
			ctx.restore();
			if (front) continue;
			electrons.push({
				x: x + Math.cos(a) * r * Math.cos(tilt) - Math.sin(a) * r * squash * Math.sin(tilt),
				y: y + Math.cos(a) * r * Math.sin(tilt) + Math.sin(a) * r * squash * Math.cos(tilt),
				front: Math.sin(a) >= 0,
				depth: Math.sin(a),
				hue: hue + ring * 18,
			});
		}
	}
	/** Paint electrons on one side of the nucleus. @param front Whether to draw near electrons. */
	function particles(front: boolean): void {
		for (const electron of electrons) {
			if (electron.front !== front) continue;
			const exposure = opacity * (0.55 + 0.45 * smoothstep(-0.45, 0.45, electron.depth));
			glow(ctx, electron.x, electron.y, Math.max(1, radius * 0.6 * bloom), `hsla(${electron.hue}, 100%, 68%, ${exposure * 0.7})`);
			glow(ctx, electron.x, electron.y, Math.max(1, radius * 0.18), `rgba(255, 255, 255, ${Math.min(1, exposure * 1.2)})`);
		}
	}
	glow(ctx, x, y, radius * 2.2 * bloom, `hsla(${hue + 30}, 90%, 60%, ${opacity * 0.25})`);
	orbits(false);
	particles(false);
	const nucleus = radius * 0.62;
	ctx.globalCompositeOperation = "source-over";
	const sphere = ctx.createRadialGradient(x - nucleus * 0.35, y - nucleus * 0.4, nucleus * 0.05, x, y, nucleus);
	sphere.addColorStop(0, `rgba(255, 255, 255, ${Math.min(1, opacity * 1.1)})`);
	sphere.addColorStop(0.25, `hsla(${hue + 25}, 90%, 72%, ${Math.min(1, opacity * 1.05)})`);
	sphere.addColorStop(0.8, `hsla(${hue + 10}, 80%, 30%, ${Math.min(1, opacity)})`);
	sphere.addColorStop(1, `hsla(${hue + 50}, 90%, 60%, ${Math.min(1, opacity)})`);
	ctx.fillStyle = sphere;
	ctx.beginPath();
	ctx.arc(x, y, nucleus, 0, TAU);
	ctx.fill();
	ctx.globalCompositeOperation = "lighter";
	orbits(true);
	particles(true);
	glow(ctx, x, y, nucleus * 1.6, `hsla(${hue + 30}, 90%, 80%, ${opacity * 0.3})`);
}

/** Paint six cursor materials, retaining the original ripple controls. @param ctx Paint context. @param size CSS dimensions. @param properties CSS inputs. */
export function paint(ctx: PaintContext, size: PaintSize, properties: PaintProperties): void {
	if (!drawable(size)) return;
	const { phase: time, hue, intensity, seed } = controls(properties);
	const phase = time + (seed - 42) * 0.013;
	const x = number(properties, "--cursor-position-x", size.width / 2, -size.width, size.width * 2);
	const y = number(properties, "--cursor-position-y", size.height / 2, -size.height, size.height * 2);
	const press = number(properties, "--cursor-press", 0, 0, 1);
	const radius = number(properties, "--cursor-size", 18, 0, 250) * (1 - press * 0.22);
	const rings = Math.floor(number(properties, "--cursor-ripples", 5, 0, 24));
	const width = number(properties, "--cursor-border-size", 1, 0, 20);
	const opacity = number(properties, "--cursor-color-intensity", 0.6, 0, 1) * intensity;
	const mode = token(properties, "--cursor-mode", "rings");
	const bloom = number(properties, "--cursor-glow", 1, 0, 2);
	const twist = number(properties, "--cursor-twist", 1, 0, 3);
	const speed = number(properties, "--cursor-speed", 0, 0, 60);
	ctx.save();
	ctx.lineCap = "round";
	ctx.lineJoin = "round";
	if (mode === "rings") {
		ctx.fillStyle = color(token(properties, "--cursor-fill-color", `hsl(${hue}, 80%, 70%)`));
		ctx.strokeStyle = color(token(properties, "--cursor-stroke-color", `hsl(${hue}, 90%, 85%)`));
		if (width) ctx.lineWidth = width;
		const progress = (((phase / TAU) % 1) + 1) % 1;
		for (let ring = 0; ring < rings; ring++) {
			const age = ring + progress;
			ctx.globalAlpha = Math.min(1, opacity * (1 - age / rings) * smoothstep(0, 0.6, age));
			ctx.beginPath();
			ctx.arc(x, y, radius * age * 1.5, 0, TAU);
			ctx.fill();
			if (width) ctx.stroke();
		}
		ctx.restore();
		return;
	}
	ctx.globalCompositeOperation = "lighter";
	glow(ctx, x, y, radius * (4 + press * 3) * bloom, `hsla(${hue}, 90%, 55%, ${opacity * 0.08})`);
	if (radius > 0) {
		if (mode === "ribbon") silk(ctx, trail(properties, x, y, radius, phase), x, y, radius, hue, phase, opacity, bloom, twist, rings, speed);
		else if (mode === "comet") comet(ctx, trail(properties, x, y, radius, phase), x, y, radius, hue, phase, opacity, bloom);
		else if (mode === "plasma") plasma(ctx, x, y, radius * 1.85, hue, phase, opacity, bloom, twist, press, seed);
		else if (mode === "lens") lens(ctx, x, y, radius * 1.8, hue, phase, opacity, bloom, width);
		else atom(ctx, x, y, radius, hue, phase, opacity, bloom, width, rings, number(properties, "--cursor-orbit", 1, 0.1, 3));
	}
	ctx.restore();
}
