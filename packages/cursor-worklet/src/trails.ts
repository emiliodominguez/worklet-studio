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
