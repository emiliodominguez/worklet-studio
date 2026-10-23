import { commonProperties, controls, drawable, number, random } from "../../core/src/index.ts";
import type { PaintContext, PaintProperties, PaintSize } from "../../core/src/types.ts";
import { camera, clipNear, dot, normalize, project, sub, toCamera } from "./geometry.ts";
import type { Camera, Vec2, Vec3 } from "./geometry.ts";
import { createScene } from "./scene.ts";
import type { Face } from "./scene.ts";

export const inputProperties = [
	...commonProperties,
	"--architecture-travel",
	"--architecture-explode",
	"--architecture-daylight",
	"--architecture-detail",
];

const mesh = createScene();

interface Surface {
	face: Face;
	points: Vec2[];
	world: Vec3[];
	center: Vec3;
	normal: Vec3;
	depth: number;
	area: number;
}

interface Light {
	day: number;
	intensity: number;
	sun: Vec3;
	fog: Vec3;
	hue: number;
	phase: number;
}

interface Mote {
	point: Vec2;
	depth: number;
	radius: number;
	alpha: number;
}

/** Suspend sparse dust inside the diagonal light volumes. @param view Camera. @param lighting Scene lighting. @param seed Repeatable positions. @param explode Disassembly. @returns Far-to-near particles for the same depth pass as the architecture. */
function dust(view: Camera, lighting: Light, seed: number, explode: number): Mote[] {
	const rng = random(seed);
	const output: Mote[] = [];
	for (let i = 0; i < 160; i++) {
		const y = 1 + rng() * 26;
		const z = 5 + rng() * 56;
		const x = -8 + (28 - y) * 0.65 + (rng() - 0.5) * 4;
		const p = toCamera([x + Math.sin(lighting.phase + i) * 0.25, y + Math.cos(lighting.phase * 2 + i) * 0.2, z], view);
		if (p[2] < 0.35) continue;
		const point = project(p, view);
		if (point[0] < 0 || point[0] > view.width || point[1] < 0 || point[1] > view.height) continue;
		output.push({
			point,
			depth: p[2],
			radius: Math.min(1.6, (view.focal * 0.019) / p[2]),
			alpha: (0.15 + rng() * 0.45) * lighting.day * (1 - explode),
		});
	}
	return output.sort(function farFirst(a, b) {
		return b.depth - a.depth;
	});
}

/** Paint a sunlit dust mote. @param ctx Context. @param mote Projected dust. */
function drawMote(ctx: PaintContext, mote: Mote): void {
	ctx.fillStyle = `rgba(255,239,189,${mote.alpha})`;
	ctx.beginPath();
	ctx.arc(...mote.point, mote.radius, 0, Math.PI * 2);
	ctx.fill();
}

/** Move a floor group into its exploded position. @param point World vertex. @param face Surface group. @param explode Separation amount. @returns Transformed vertex. */
function transform(point: Vec3, face: Face, explode: number): Vec3 {
	return [
		point[0] + face.wing * explode * (3 + face.level * 1.1),
		point[1] + face.level * explode * 3.6,
		point[2] + Math.sin(face.level * 1.6) * explode * 1.5,
	];
}

/** Project and cull a polygon. @param points World vertices. @param view Camera. @returns Visible pixel polygon or an empty list. */
function polygon(points: Vec3[], view: Camera): Vec2[] {
	const clipped = clipNear(
		points.map(function local(point) {
			return toCamera(point, view);
		}),
	);
	const projected = clipped.map(function screen(point) {
		return project(point, view);
	});
	if (projected.length < 3) return [];
	if (
		projected.every(function left(p) {
			return p[0] < -1;
		}) ||
		projected.every(function right(p) {
			return p[0] > view.width + 1;
		}) ||
		projected.every(function top(p) {
			return p[1] < -1;
		}) ||
		projected.every(function bottom(p) {
			return p[1] > view.height + 1;
		})
	)
		return [];
	return projected;
}

/** Trace a closed screen polygon. @param ctx Paint context. @param points Screen vertices. */
function path(ctx: PaintContext, points: Vec2[]): void {
	ctx.beginPath();
	for (let i = 0; i < points.length; i++) {
		if (i === 0) ctx.moveTo(...points[i]);
		else ctx.lineTo(...points[i]);
	}
	ctx.closePath();
}

/** Calculate polygon area for detail culling. @param points Screen polygon. @returns Absolute projected area. */
function area(points: Vec2[]): number {
	let value = 0;
	for (let i = 0; i < points.length; i++) {
		const a = points[i],
			b = points[(i + 1) % points.length];
		value += a[0] * b[1] - a[1] * b[0];
	}
	return Math.abs(value) * 0.5;
}

/** Prepare a depth-sorted view of the bounded mesh. @param view Camera. @param explode Separation. @param reflection Mirror across the pool plane. @returns Visible surfaces. */
function surfaces(view: Camera, explode: number, reflection = false, phase = 0): Surface[] {
	const output: Surface[] = [];
	for (const face of mesh) {
		if (reflection && (face.material === "water" || face.material === "sunbeam" || face.center[1] < 0.2)) continue;
		const world = face.points.map(function move(point): Vec3 {
			const p = transform(point, face, explode);
			return reflection ? [p[0], -p[1], p[2]] : p;
		});
		let center = transform(face.center, face, explode);
		const normal: Vec3 = [...face.normal];
		if (reflection) {
			center = [center[0], -center[1], center[2]];
			normal[1] *= -1;
		}
		if (face.material !== "sunbeam" && dot(normal, sub(view.position, center)) <= 0) continue;
		const points = polygon(world, view);
		if (points.length < 3) continue;
		if (reflection) {
			for (const point of points) {
				const strength = Math.max(0, point[1] / view.height - 0.48) * 2.2;
				point[0] += Math.sin(point[1] * 0.055 + phase * 3) * strength;
				point[1] += Math.cos(point[1] * 0.035 + phase * 2) * strength * 0.3;
			}
		}
		const projectedArea = area(points);
		if (projectedArea < 0.15) continue;
		output.push({ face, world, points, center, normal, depth: toCamera(center, view)[2], area: projectedArea });
	}
	output.sort(function farFirst(a, b) {
		return b.depth - a.depth;
	});
	return output;
}

/** Blend atmospheric depth into a material color. @param base Linear-ish RGB. @param fog Atmosphere RGB. @param distance Camera distance. @param multiplier Exposure factor. @returns CSS color. */
function color(base: Vec3, fog: Vec3, distance: number, multiplier = 1): string {
	const haze = Math.min(0.34, Math.max(0, distance - 12) * 0.003);
	const result = base.map(function channel(value, i) {
		return Math.round(Math.max(0, Math.min(255, value * multiplier * (1 - haze) + fog[i] * haze)));
	});
	return `rgb(${result.join(" ")})`;
}

/** Surface illumination combines directional daylight, skylight, recess occlusion and warm practical lights. @param surface Surface. @param lighting Lighting state. @param reflection Whether to reconstruct its unmirrored lighting. @returns Material RGB. */
function shade(surface: Surface, lighting: Light, reflection: boolean): Vec3 {
	const { face } = surface;
	const n: Vec3 = [...surface.normal];
	const p: Vec3 = [...surface.center];
	if (reflection) {
		n[1] *= -1;
		p[1] *= -1;
	}
	if (face.material === "light") return [255, 199 + lighting.day * 25, 124 + lighting.day * 50];
	const recess = Math.max(0, Math.min(1, (Math.abs(p[0]) - 8) / 9));
	const skylight = 0.22 + Math.max(0, n[1]) * 0.25 + Math.min(28, p[1]) * 0.015;
	const direct = Math.max(0, dot(n, lighting.sun));
	const occlusion = 1 - recess * 0.65;
	const daylight = lighting.day * (skylight * 0.78 + direct * 1.4) * occlusion;
	const nearStrip = Math.exp(-Math.abs(((((p[1] + 0.35) % 7) + 7) % 7) - 6.5) * 2) * recess;
	const practical = (1 - lighting.day) * 0.13 + nearStrip * 0.12;
	const variation = 0.96 + Math.sin(p[0] * 5.1 + p[1] * 3.4 + p[2] * 1.7) * 0.025;
	let base: Vec3 = [221, 210, 188];
	if (face.material === "stone") base = [151, 167, 162];
	if (face.material === "bronze") {
		if (face.center[2] > 31 && face.center[2] < 33 && Math.hypot(face.center[0], face.center[1] - 9.2) < 4) {
			return [255, 198 + lighting.day * 30, 107 + lighting.day * 50];
		}
		const specular = Math.pow(Math.max(0, dot(n, normalize([0.4, 0.55, -1]))), 9) * 0.7;
		base = [184 + specular * 150, 125 + specular * 145, 59 + specular * 130];
	}
	const level = (0.09 + daylight + practical) * variation * lighting.intensity;
	const tint = Math.sin((lighting.hue * Math.PI) / 180) * 4;
	return [base[0] * level + practical * 45, base[1] * level + 8 * (1 - lighting.day), base[2] * level + 20 * (1 - lighting.day) + tint];
}

/** Paint recessed strip lighting directly on its receiver, avoiding nearly coplanar depth sorting. @param ctx Context. @param surface Receiver. @param view Camera. @param lighting Lighting state. */
function stripLight(ctx: PaintContext, surface: Surface, view: Camera, lighting: Light): void {
	const { center, normal, world, face } = surface;
	let a: Vec3, b: Vec3;
	const minX = Math.min(
		...world.map(function x(p) {
			return p[0];
		}),
	);
	const maxX = Math.max(
		...world.map(function x(p) {
			return p[0];
		}),
	);
	const minZ = Math.min(
		...world.map(function z(p) {
			return p[2];
		}),
	);
	const maxZ = Math.max(
		...world.map(function z(p) {
			return p[2];
		}),
	);
	const gallery = Math.abs(Math.abs(face.center[0]) - 9) < 0.01 && Math.abs(normal[0]) > 0.9 && Math.abs((face.center[1] + 0.325) % 7) < 0.01;
	const bridge =
		normal[2] < -0.9 &&
		(Math.abs(face.center[2] - 26) < 0.01 || Math.abs(face.center[2] - 38) < 0.01) &&
		(Math.abs(face.center[1] - 17.175) < 0.01 || Math.abs(face.center[1] - 6.675) < 0.01);
	const pool = face.material === "stone" && normal[1] > 0.9 && Math.abs(face.center[1] - 0.16) < 0.01;
	if (gallery) {
		a = [center[0], center[1] + 0.2, minZ];
		b = [center[0], center[1] + 0.2, maxZ];
	} else if (bridge) {
		a = [minX, center[1] + 0.2, center[2]];
		b = [maxX, center[1] + 0.2, center[2]];
	} else if (pool) {
		a = [center[0], center[1], minZ];
		b = [center[0], center[1], maxZ];
	} else return;
	for (const [width, alpha] of [
		[12, 0.035],
		[6, 0.09],
		[2, 0.4],
		[0.8, 0.95],
	]) {
		ctx.lineWidth = width;
		ctx.strokeStyle = `rgba(255,211,144,${alpha * (1 - lighting.day * 0.15)})`;
		line(ctx, a, b, view);
	}
}

/** Interpolate a point on a planar quad. @param points Four corners. @param u Horizontal fraction. @param v Vertical fraction. @returns World point. */
function quadPoint(points: Vec3[], u: number, v: number): Vec3 {
	return [0, 1, 2].map(function coordinate(axis) {
		return points[0][axis] * (1 - u) * (1 - v) + points[1][axis] * u * (1 - v) + points[2][axis] * u * v + points[3][axis] * (1 - u) * v;
	}) as Vec3;
}

/** Draw a projected segment, clipping at the camera plane. @param ctx Context. @param a Start. @param b End. @param view Camera. */
function line(ctx: PaintContext, a: Vec3, b: Vec3, view: Camera): void {
	const points = clipNear([toCamera(a, view), toCamera(b, view)]);
	if (points.length < 2) return;
	ctx.beginPath();
	ctx.moveTo(...project(points[0], view));
	ctx.lineTo(...project(points[1], view));
	ctx.stroke();
}

/** Add restrained formwork seams, tie holes and surface grain in perspective. @param ctx Context. @param surface Concrete surface. @param view Camera. @param detail Detail multiplier. */
function concrete(ctx: PaintContext, surface: Surface, view: Camera, detail: number): void {
	if (surface.area < 900 || surface.world.length !== 4 || detail < 0.25) return;
	const p = surface.world;
	const width = Math.hypot(...sub(p[1], p[0]));
	const height = Math.hypot(...sub(p[3], p[0]));
	if (width < 0.4 || height < 0.4) return;
	ctx.strokeStyle = "rgba(15,22,23,0.17)";
	ctx.lineWidth = 0.6;
	const rows = Math.min(9, Math.floor(height / 1.8));
	for (let row = 1; row <= rows; row++) line(ctx, quadPoint(p, 0, row / (rows + 1)), quadPoint(p, 1, row / (rows + 1)), view);
	ctx.fillStyle = "rgba(15,22,23,0.24)";
	for (const u of [0.16, 0.84])
		for (const v of [0.18, 0.82]) {
			const point = toCamera(quadPoint(p, u, v), view);
			if (point[2] < 0.35) continue;
			const xy = project(point, view);
			ctx.beginPath();
			ctx.arc(...xy, Math.min(1.5, (view.focal * 0.028) / point[2]), 0, Math.PI * 2);
			ctx.fill();
		}
	const rng = random(Math.floor(surface.face.center[0] * 321 + surface.face.center[1] * 188 + surface.face.center[2] * 97));
	const count = Math.min(30, Math.floor(surface.area * 0.00045 * detail));
	ctx.strokeStyle = "rgba(230,226,211,0.07)";
	for (let i = 0; i < count; i++) {
		const u = rng(),
			v = rng();
		line(ctx, quadPoint(p, u, v), quadPoint(p, Math.min(1, u + 0.018), v), view);
	}
}

/** Project roof-beam shadows onto a floor receiver. @param ctx Context. @param surface Floor. @param view Camera. @param lighting Sun direction. @param explode Floor separation. */
function shadows(ctx: PaintContext, surface: Surface, view: Camera, lighting: Light, explode: number): void {
	if (surface.normal[1] < 0.9 || Math.abs(surface.center[1]) > 0.1 || lighting.day < 0.05) return;
	ctx.save();
	path(ctx, surface.points);
	ctx.clip();
	ctx.fillStyle = `rgba(12,21,25,${0.25 * lighting.day})`;
	const height = 29 + explode * 14.4;
	const dx = (-lighting.sun[0] * height) / lighting.sun[1];
	const dz = (-lighting.sun[2] * height) / lighting.sun[1];
	for (let z = -6; z <= 66; z += 12) {
		const points = polygon(
			[
				[-18 + dx, 0.02, z + dz],
				[18 + dx, 0.02, z + dz],
				[18 + dx, 0.02, z + dz + 1.3],
				[-18 + dx, 0.02, z + dz + 1.3],
			],
			view,
		);
		if (points.length) {
			path(ctx, points);
			ctx.fill();
		}
	}
	ctx.restore();
}

/** Render one opaque or reflective material. @param ctx Context. @param surface Projected surface. @param view Camera. @param lighting Lighting. @param detail Detail budget. @param explode Separation. @param reflection Reflection pass. */
function drawSurface(ctx: PaintContext, surface: Surface, view: Camera, lighting: Light, detail: number, explode: number, reflection = false): void {
	if (surface.face.material === "sunbeam") {
		if (lighting.day < 0.1 || explode > 0.95) return;
		const top = project(toCamera(surface.world[0], view), view);
		const bottom = project(toCamera(surface.world[2], view), view);
		const shaft = ctx.createLinearGradient(...top, ...bottom);
		const opacity = lighting.day * (1 - explode) * 0.035;
		shaft.addColorStop(0, `rgba(255,239,193,${opacity * 1.5})`);
		shaft.addColorStop(0.45, `rgba(255,225,161,${opacity})`);
		shaft.addColorStop(1, "rgba(255,220,160,0)");
		path(ctx, surface.points);
		ctx.fillStyle = shaft;
		ctx.fill();
		return;
	}
	if (surface.face.material === "water") {
		path(ctx, surface.points);
		ctx.fillStyle = `rgba(13,35,36,${0.3 + (1 - lighting.day) * 0.15})`;
		ctx.fill();
		return;
	}
	const rgb = shade(surface, lighting, reflection);
	const style = color(rgb, lighting.fog, surface.depth, reflection ? 0.77 : 1);
	path(ctx, surface.points);
	if (surface.area > 1500 && surface.face.material !== "light" && !reflection) {
		const ys = surface.points.map(function vertical(p) {
			return p[1];
		});
		const top = Math.min(...ys),
			bottom = Math.max(...ys);
		const gradient = ctx.createLinearGradient(0, top, 0, Math.max(top + 1, bottom));
		gradient.addColorStop(0, color(rgb, lighting.fog, surface.depth, 1.08));
		gradient.addColorStop(1, color(rgb, lighting.fog, surface.depth, 0.83));
		ctx.fillStyle = gradient;
	} else ctx.fillStyle = style;
	ctx.fill();
	// A same-color hairline seals anti-alias cracks between adjacent mesh faces.
	ctx.strokeStyle = style;
	ctx.lineWidth = 0.45;
	ctx.stroke();
	if (surface.face.material === "light" && surface.area > 0.6) {
		for (const width of [10, 5, 2]) {
			ctx.strokeStyle = `rgba(255,195,101,${(1 - lighting.day * 0.6) * 0.065})`;
			ctx.lineWidth = width;
			ctx.stroke();
		}
	}
	if (!reflection && surface.face.material !== "light") {
		if (surface.face.material === "concrete") concrete(ctx, surface, view, detail);
		if (surface.face.material === "stone") shadows(ctx, surface, view, lighting, explode);
		if (surface.area > 500 && surface.normal[1] >= 0 && surface.world.length === 4) {
			ctx.strokeStyle = `rgba(255,240,204,${lighting.day * 0.12})`;
			ctx.lineWidth = 0.7;
			line(ctx, surface.world[0], surface.world[1], view);
		}
	}
	if (surface.face.material === "concrete" || surface.face.material === "stone") stripLight(ctx, surface, view, lighting);
}

/** Draw the entire deterministic architecture image using Paint API paths and gradients. @param ctx Paint context. @param size CSS dimensions. @param properties CSS custom properties. */
export function paint(ctx: PaintContext, size: PaintSize, properties: PaintProperties): void {
	if (!drawable(size)) return;
	const shared = controls(properties);
	const travel = number(properties, "--architecture-travel", 0, 0, 1);
	const explode = number(properties, "--architecture-explode", 0, 0, 1);
	const day = number(properties, "--architecture-daylight", 0.85, 0, 1);
	const detail = number(properties, "--architecture-detail", 1, 0, 1);
	const phase = shared.phase;
	const turnProgress = Math.max(0, (travel - 0.62) / 0.38);
	const turn = turnProgress * turnProgress * (3 - 2 * turnProgress);
	const eye: Vec3 = [
		(-3.8 + travel * 5.6) * (1 - explode) - 25 * explode + shared.viewX * 2.8,
		(4.5 + travel * 7.5) * (1 - explode) + 28 * explode - shared.viewY * 1.2,
		(-15 + travel * 64) * (1 - explode) - 62 * explode,
	];
	const target: Vec3 = [
		shared.viewX * (8 + explode * 8) + Math.sin(turn * Math.PI) * 18 * (1 - explode),
		(11.3 + travel * 3.8 - turn * 8) * (1 - explode) + explode * 20 - shared.viewY * 8,
		(40 + travel * 30 - turn * 105) * (1 - explode) + explode * 25,
	];
	eye[0] += Math.sin(phase) * 0.2;
	eye[1] += (Math.cos(phase) - 1) * 0.07;
	const view = camera(eye, target, size.width, size.height);
	const lighting: Light = {
		day,
		intensity: shared.intensity,
		sun: normalize([-0.65, 1, -0.37]),
		fog: [19 + day * 160, 36 + day * 126, 47 + day * 85],
		hue: shared.hue,
		phase,
	};
	ctx.save();
	const sky = ctx.createLinearGradient(0, 0, 0, size.height);
	sky.addColorStop(0, color([13 + day * 100, 34 + day * 133, 53 + day * 143], [0, 0, 0], 0));
	sky.addColorStop(0.65, color([34 + day * 220, 43 + day * 189, 55 + day * 143], [0, 0, 0], 0));
	sky.addColorStop(1, "#152a2b");
	ctx.fillStyle = sky;
	ctx.fillRect(0, 0, size.width, size.height);
	const pool = polygon(
		[
			[-5.5, 0.02, 6],
			[-5.5, 0.02, 62],
			[5.5, 0.02, 62],
			[5.5, 0.02, 6],
		],
		view,
	);
	if (pool.length) {
		ctx.save();
		path(ctx, pool);
		ctx.clip();
		ctx.fillStyle = "#25484a";
		ctx.fillRect(0, 0, size.width, size.height);
		for (const surface of surfaces(view, explode, true, phase)) drawSurface(ctx, surface, view, lighting, 0, explode, true);
		ctx.restore();
	}
	const motes = dust(view, lighting, shared.seed, explode);
	let moteIndex = 0;
	for (const surface of surfaces(view, explode)) {
		while (moteIndex < motes.length && motes[moteIndex].depth > surface.depth) drawMote(ctx, motes[moteIndex++]);
		drawSurface(ctx, surface, view, lighting, detail, explode);
	}
	while (moteIndex < motes.length) drawMote(ctx, motes[moteIndex++]);
	// The ripples follow the projected water plane rather than the screen.
	if (pool.length) {
		// Restrict ripple glints to the nearer pool; bridges and the oculus remain correctly occluded.
		ctx.save();
		path(ctx, pool);
		ctx.clip();
		ctx.lineWidth = 0.65;
		const rng = random(shared.seed);
		for (let i = 0; i < 50; i++) {
			const z = 7 + rng() * Math.max(1, 39 - travel * 5);
			const x = -5 + rng() * 10;
			const offset = Math.sin(phase * 2 + z * 1.7) * 0.05;
			ctx.strokeStyle = `rgba(191,220,211,${0.025 + rng() * 0.065})`;
			line(ctx, [x, 0.04, z + offset], [Math.min(5.4, x + 0.3 + rng() * 1.2), 0.04, z + offset], view);
		}
		ctx.restore();
	}
	// A subtle lens falloff anchors the foreground without obscuring the architecture.
	const vignette = ctx.createRadialGradient(
		size.width * 0.52,
		size.height * 0.45,
		Math.min(size.width, size.height) * 0.18,
		size.width * 0.52,
		size.height * 0.45,
		Math.max(size.width, size.height) * 0.74,
	);
	vignette.addColorStop(0, "transparent");
	vignette.addColorStop(1, "rgba(5,12,15,0.45)");
	ctx.fillStyle = vignette;
	ctx.fillRect(0, 0, size.width, size.height);
	ctx.restore();
}
