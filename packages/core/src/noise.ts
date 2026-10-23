/** Hash a grid corner without mutable state. @param x Integer x. @param y Integer y. @param seed Variation seed. @returns Noise in [-1, 1]. */
function hash(x: number, y: number, seed: number): number {
	let n = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 69069);
	n = Math.imul(n ^ (n >>> 13), 1274126177);
	return ((n ^ (n >>> 16)) >>> 0) / 2147483647.5 - 1;
}

/** Smooth value noise with zero derivatives at grid boundaries. @param x Sample x. @param y Sample y. @param seed Variation seed. @returns Continuous noise in [-1, 1]. */
export function noise(x: number, y: number, seed: number): number {
	const ix = Math.floor(x),
		iy = Math.floor(y);
	const fx = x - ix,
		fy = y - iy;
	const u = fx * fx * fx * (fx * (fx * 6 - 15) + 10),
		v = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
	const a = hash(ix, iy, seed),
		b = hash(ix + 1, iy, seed),
		c = hash(ix, iy + 1, seed),
		d = hash(ix + 1, iy + 1, seed);
	return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** Accumulate four spatial frequencies for cloud and terrain detail. @param x Sample x. @param y Sample y. @param seed Variation seed. @returns Fractal noise in [-1, 1]. */
export function fractal(x: number, y: number, seed: number): number {
	let value = 0,
		weight = 0.55;
	for (let octave = 0; octave < 4; octave++) {
		value += noise(x, y, seed + octave * 17) * weight;
		x = x * 2.03 + 13.7;
		y = y * 2.03 + 9.2;
		weight *= 0.48;
	}
	return value;
}
