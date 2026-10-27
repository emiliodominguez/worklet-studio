/** Partial derivatives of the most recent `noised` call. */
export const slope = { x: 0, y: 0 };

/** Hash a lattice corner without mutable state. @param x Integer x. @param y Integer y. @param seed Variation seed. @returns Value in [-1, 1]. */
function hash(x: number, y: number, seed: number): number {
	let n = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 69069);
	n = Math.imul(n ^ (n >>> 13), 1274126177);
	return ((n ^ (n >>> 16)) >>> 0) / 2147483647.5 - 1;
}

/** Quintic value noise with its analytic gradient, written to `slope`. Knowing the gradient lets a shader pre-filter detail finer than its samples. @param x Sample x. @param y Sample y. @param seed Variation seed. @returns Noise in [-1, 1]. */
export function noised(x: number, y: number, seed: number): number {
	const ix = Math.floor(x),
		iy = Math.floor(y);
	const fx = x - ix,
		fy = y - iy;
	const u = fx * fx * fx * (fx * (fx * 6 - 15) + 10),
		v = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
	const du = 30 * fx * fx * (fx - 1) * (fx - 1),
		dv = 30 * fy * fy * (fy - 1) * (fy - 1);
	const a = hash(ix, iy, seed),
		b = hash(ix + 1, iy, seed),
		c = hash(ix, iy + 1, seed),
		d = hash(ix + 1, iy + 1, seed);
	const k = a - b - c + d;
	slope.x = du * (b - a + k * v);
	slope.y = dv * (c - a + k * u);
	return a + (b - a) * u + (c - a) * v + k * u * v;
}
