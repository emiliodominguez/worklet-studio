import type { PaintContext, PaintSize } from "../../core/src/types.ts";

/** A shader returning a CSS color plus its displayed channels (0–1) for refinement. The result object may be reused between calls. */
export type Shader = (u: number, v: number) => { color: string; r: number; g: number; b: number };

/** Gradient-scanline sampler that bisects intervals where any displayed channel jumps, so interference fringes and highlights keep sharp edges while flat regions stay coarse. Neighbouring rows share refinement decisions so scanlines agree, and rows blend per pixel line like core `surface`. @param ctx Paint context. @param size Surface dimensions. @param shade Sampler in normalized coordinates. @param columns Base samples per row. @param rows Rows of samples. @param threshold Channel jump that triggers refinement. @param depth Maximum bisection depth. */
export function adaptiveSurface(ctx: PaintContext, size: PaintSize, shade: Shader, columns: number, rows: number, threshold = 0.07, depth = 2): void {
	const height = size.height / rows;
	const pixel = Math.max(1, size.height / 1200);
	const positions: number[] = [],
		colors: string[] = [];
	const coarseColors: string[][] = [[], [], []],
		coarseLevels = [new Float64Array((columns + 1) * 3), new Float64Array((columns + 1) * 3), new Float64Array((columns + 1) * 3)];
	/** Largest channel difference between two samples. @param a First channel triple. @param i First offset. @param b Second channel triple. @param j Second offset. @returns Jump. */
	function jump(a: ArrayLike<number>, i: number, b: ArrayLike<number>, j: number): number {
		return Math.max(Math.abs(a[i] - b[j]), Math.abs(a[i + 1] - b[j + 1]), Math.abs(a[i + 2] - b[j + 2]));
	}
	// One slot per recursion depth: deeper calls only write lower slots, so a parent's midpoint survives its left half.
	const middleLevels = new Float64Array(3 * (depth + 2));
	/** Recursively bisect between two known samples whose channels are stored at depth-indexed slots. @param u0 Left position. @param u1 Right position. @param l Left channels. @param li Left offset. @param r Right channels. @param ri Right offset. @param v Row position. @param remaining Remaining depth. @param force Refine this level regardless of the jump. */
	function refine(
		u0: number,
		u1: number,
		l: ArrayLike<number>,
		li: number,
		r: ArrayLike<number>,
		ri: number,
		v: number,
		remaining: number,
		force: boolean,
	): void {
		if (remaining <= 0 || (!force && jump(l, li, r, ri) < threshold)) return;
		const middle = (u0 + u1) / 2;
		const result = shade(middle, v),
			color = result.color,
			slot = remaining * 3;
		middleLevels[slot] = result.r;
		middleLevels[slot + 1] = result.g;
		middleLevels[slot + 2] = result.b;
		refine(u0, middle, l, li, middleLevels, slot, v, remaining - 1, false);
		positions.push(middle);
		colors.push(color);
		refine(middle, u1, middleLevels, slot, r, ri, v, remaining - 1, false);
	}
	/** Fill a coarse row buffer. @param slot Buffer index. @param row Row index. */
	function coarse(slot: number, row: number): void {
		const v = Math.min(row, rows) / rows,
			levels = coarseLevels[slot];
		for (let column = 0; column <= columns; column++) {
			const result = shade(column / columns, v);
			coarseColors[slot][column] = result.color;
			levels[column * 3] = result.r;
			levels[column * 3 + 1] = result.g;
			levels[column * 3 + 2] = result.b;
		}
	}
	let previous: CanvasGradient | undefined;
	ctx.save();
	coarse(1, 0);
	coarse(2, 1);
	coarseLevels[0].set(coarseLevels[1]);
	for (let row = 0; row <= rows; row++) {
		const v = row / rows;
		if (row) {
			const recycled = coarseColors[0],
				recycledLevels = coarseLevels[0];
			coarseColors[0] = coarseColors[1];
			coarseLevels[0] = coarseLevels[1];
			coarseColors[1] = coarseColors[2];
			coarseLevels[1] = coarseLevels[2];
			coarseColors[2] = recycled;
			coarseLevels[2] = recycledLevels;
			if (row < rows) coarse(2, row + 1);
			else coarseLevels[2].set(coarseLevels[1]);
		}
		positions.length = 0;
		colors.length = 0;
		const [above, here, below] = coarseLevels;
		const gradient = ctx.createLinearGradient(0, 0, size.width, 0);
		for (let column = 0; column <= columns; column++) {
			positions.push(column / columns);
			colors.push(coarseColors[1][column]);
			if (column === columns) continue;
			const i = column * 3;
			if (Math.max(jump(above, i, above, i + 3), jump(here, i, here, i + 3), jump(below, i, below, i + 3)) >= threshold)
				refine(column / columns, (column + 1) / columns, here, i, here, i + 3, v, depth, true);
		}
		for (let i = 0; i < positions.length; i++) gradient.addColorStop(positions[i], colors[i]);
		if (previous) {
			const start = Math.floor((row - 1) * height),
				end = Math.ceil(row * height);
			for (let y = start; y < end; y += pixel) {
				const blend = Math.max(0, Math.min(1, (y + 0.5 - (row - 1) * height) / height));
				ctx.globalAlpha = 1;
				ctx.fillStyle = previous;
				ctx.fillRect(0, y, size.width, pixel);
				ctx.globalAlpha = blend;
				ctx.fillStyle = gradient;
				ctx.fillRect(0, y, size.width, pixel);
			}
		}
		previous = gradient;
	}
	ctx.restore();
}
