export type Vec3 = [number, number, number];
export type Vec2 = [number, number];

export interface Camera {
	position: Vec3;
	right: Vec3;
	up: Vec3;
	forward: Vec3;
	focal: number;
	width: number;
	height: number;
}

/** Subtract vectors. @param a First vector. @param b Second vector. @returns Difference. */
export function sub(a: Vec3, b: Vec3): Vec3 {
	return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

/** Dot product. @param a First vector. @param b Second vector. @returns Scalar product. */
export function dot(a: Vec3, b: Vec3): number {
	return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/** Cross product. @param a First vector. @param b Second vector. @returns Perpendicular vector. */
export function cross(a: Vec3, b: Vec3): Vec3 {
	return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

/** Normalize a direction. @param v Vector. @returns Unit vector, or zero for a degenerate vector. */
export function normalize(v: Vec3): Vec3 {
	const length = Math.hypot(...v) || 1;
	return [v[0] / length, v[1] / length, v[2] / length];
}

/** Construct a perspective camera looking at a world point. @param position Eye position. @param target Look-at point. @param width Image width. @param height Image height. @returns Camera basis and projection. */
export function camera(position: Vec3, target: Vec3, width: number, height: number): Camera {
	const forward = normalize(sub(target, position));
	const right = normalize(cross([0, 1, 0], forward));
	return { position, forward, right, up: cross(forward, right), focal: Math.max(width * 0.62, height * 0.72), width, height };
}

/** Transform a world point to camera coordinates. @param point World point. @param view Camera. @returns Camera-space point. */
export function toCamera(point: Vec3, view: Camera): Vec3 {
	const relative = sub(point, view.position);
	return [dot(relative, view.right), dot(relative, view.up), dot(relative, view.forward)];
}

/** Clip a convex polygon against the near plane before perspective division. @param points Camera-space polygon. @param near Near distance. @returns Clipped polygon. */
export function clipNear(points: Vec3[], near = 0.35): Vec3[] {
	const output: Vec3[] = [];
	for (let i = 0; i < points.length; i++) {
		const a = points[i];
		const b = points[(i + 1) % points.length];
		if (a[2] >= near) output.push(a);
		if (a[2] >= near !== b[2] >= near) {
			const t = (near - a[2]) / (b[2] - a[2]);
			output.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, near]);
		}
	}
	return output;
}

/** Project a visible camera point. @param point Clipped camera-space point. @param view Camera. @returns Pixel coordinates. */
export function project(point: Vec3, view: Camera): Vec2 {
	const depth = Math.max(0.35, point[2]);
	return [view.width * 0.5 + (point[0] * view.focal) / depth, view.height * 0.5 - (point[1] * view.focal) / depth];
}
