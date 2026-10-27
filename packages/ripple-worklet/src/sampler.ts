import type { PaintContext, PaintSize } from "../../core/src/types.ts";

/** A shader returning a CSS color and, for refinement, the displayed brightness (0–1) of that color. The result object may be reused between calls. */
export type Shader = (u: number, v: number) => { color: string; level: number };

/** Gradient-scanline sampler that bisects intervals whose brightness jumps, so sharp highlights stay sharp without sampling flat regions densely. Rows blend per pixel line like core `surface`. @param ctx Paint context. @param size Surface dimensions. @param shade Sampler in normalized coordinates. @param columns Base samples per row. @param rows Rows of samples. @param threshold Brightness jump that triggers refinement. @param depth Maximum bisection depth. */
export function adaptiveSurface(ctx: PaintContext, size: PaintSize, shade: Shader, columns: number, rows: number, threshold = 0.08, depth = 2): void {
	const height = size.height / rows;
	const pixel = Math.max(1, size.height / 1200);
	const positions: number[] = [],
		colors: string[] = [];
	// Coarse samples for the previous, current, and next rows; refinement decisions look at all three so neighbouring scanlines agree.
	const coarseColors: string[][] = [[], [], []],
		coarseLevels = [new Float64Array(columns + 1), new Float64Array(columns + 1), new Float64Array(columns + 1)];
	/** Recursively bisect between two already-known samples. @param u0 Left position. @param l0 Left brightness. @param u1 Right position. @param l1 Right brightness. @param v Row position. @param remaining Remaining depth. @param force Refine this level regardless of the jump. */
	function refine(u0: number, l0: number, u1: number, l1: number, v: number, remaining: number, force: boolean): void {
		if (remaining <= 0 || (!force && Math.abs(l1 - l0) < threshold)) return;
		const middle = (u0 + u1) / 2;
		const result = shade(middle, v),
			color = result.color,
			level = result.level;
		refine(u0, l0, middle, level, v, remaining - 1, false);
		positions.push(middle);
		colors.push(color);
		refine(middle, level, u1, l1, v, remaining - 1, false);
	}
	/** Fill a coarse row buffer. @param slot Buffer index. @param row Row index. */
	function coarse(slot: number, row: number): void {
		const v = Math.min(row, rows) / rows;
		for (let column = 0; column <= columns; column++) {
			const result = shade(column / columns, v);
			coarseColors[slot][column] = result.color;
			coarseLevels[slot][column] = result.level;
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
			const jump = Math.max(
				Math.abs(above[column + 1] - above[column]),
				Math.abs(here[column + 1] - here[column]),
				Math.abs(below[column + 1] - below[column]),
			);
			if (jump >= threshold) refine(column / columns, here[column], (column + 1) / columns, here[column + 1], v, depth, true);
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
