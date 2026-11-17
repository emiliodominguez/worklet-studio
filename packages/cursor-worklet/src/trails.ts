export interface TrailPoint {
	x: number;
	y: number;
}

/** Decode bounded cursor history supplied through CSS. @param value Space-separated coordinate pairs. @returns At most 32 finite points, newest first. */
export function parseTrail(value: string): TrailPoint[] {
	const parts = value.trim().split(/\s+/).slice(0, 64);
	const points: TrailPoint[] = [];
	for (let index = 0; index + 1 < parts.length; index += 2) {
		const x = Number(parts[index]),
			y = Number(parts[index + 1]);
		if (!Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > 1e6 || Math.abs(y) > 1e6) continue;
		points.push({ x, y });
	}
	return points;
}

/** A polyline with at least one point. */
export type NonEmptyTrail = readonly [TrailPoint, ...TrailPoint[]];

/**
 * Prefix a trail with a head when it is empty, so later stages always have a point to anchor to.
 * @param points Decoded trail, possibly empty.
 * @param head Position used when the trail is empty.
 * @returns A trail with at least one point.
 */
export function anchorTrail(points: TrailPoint[], head: TrailPoint): NonEmptyTrail {
	const [first, ...rest] = points;
	return first ? [first, ...rest] : [head];
}

/** Redistribute a polyline into evenly spaced points along its length, so width and fade profiles follow the visible trail rather than how densely it was sampled. @param points Polyline, head first. @param count Number of output points, an integer of at least 2. @returns Exactly `count` points; a degenerate polyline repeats its head. @throws RangeError when count is below 2, which has no spacing to distribute. */
export function resampleTrail(points: NonEmptyTrail, count: number): TrailPoint[] {
	if (!Number.isInteger(count) || count < 2) throw new RangeError(`A resampled trail needs at least 2 points: ${count}`);
	const distances = [0];
	for (let i = 1; i < points.length; i++)
		distances.push(distances[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
	const total = distances[distances.length - 1];
	const result: TrailPoint[] = [];
	let segment = 1;
	for (let i = 0; i < count; i++) {
		const target = (total * i) / (count - 1);
		while (segment < points.length - 1 && distances[segment] < target) segment++;
		const a = points[Math.max(0, segment - 1)],
			b = points[Math.min(points.length - 1, segment)];
		const span = distances[Math.min(points.length - 1, segment)] - distances[Math.max(0, segment - 1)];
		const t = span > 1e-9 ? (target - distances[segment - 1]) / span : 0;
		result.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
	}
	return result;
}

/** Subdivide a history curve with Catmull–Rom interpolation. @param points Control points. @returns Smooth positions with bounded sample count. */
export function smoothTrail(points: TrailPoint[]): TrailPoint[] {
	if (points.length < 2) return points;
	const result: TrailPoint[] = [];
	for (let index = 0; index < points.length - 1; index++) {
		const a = points[Math.max(0, index - 1)],
			b = points[index],
			c = points[index + 1],
			d = points[Math.min(points.length - 1, index + 2)];
		for (let step = 0; step < 3; step++) {
			const t = step / 3,
				t2 = t * t,
				t3 = t2 * t;
			result.push({
				x: 0.5 * (2 * b.x + (-a.x + c.x) * t + (2 * a.x - 5 * b.x + 4 * c.x - d.x) * t2 + (-a.x + 3 * b.x - 3 * c.x + d.x) * t3),
				y: 0.5 * (2 * b.y + (-a.y + c.y) * t + (2 * a.y - 5 * b.y + 4 * c.y - d.y) * t2 + (-a.y + 3 * b.y - 3 * c.y + d.y) * t3),
			});
		}
	}
	result.push(points[points.length - 1]);
	return result;
}
