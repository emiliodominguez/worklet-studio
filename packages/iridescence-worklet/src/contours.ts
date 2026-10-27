import type { PaintContext } from "../../core/src/types.ts";

/** Corner offsets of a grid cell, clockwise from the top left. */
const CORNERS = [
	[0, 0],
	[1, 0],
	[1, 1],
	[0, 1],
];

/** Add every integer iso-line of a sampled field to the current path as straight segments (marching squares). Cells where the field changes by more than `densest` levels are skipped, since their lines would be finer than they can be drawn. @param ctx Paint context with an open path. @param field Row-major samples, (columns + 1) × (rows + 1). @param columns Grid cells across. @param rows Grid cells down. @param cellWidth Cell width in CSS pixels. @param cellHeight Cell height in CSS pixels. @param densest Largest level span drawn in one cell. @param budget Maximum segments. @returns Segments added. */
export function isolines(
	ctx: PaintContext,
	field: Float64Array,
	columns: number,
	rows: number,
	cellWidth: number,
	cellHeight: number,
	densest: number,
	budget: number,
): number {
	const stride = columns + 1,
		values = [0, 0, 0, 0],
		points: number[] = [];
	let segments = 0;
	for (let row = 0; row < rows; row++) {
		for (let column = 0; column < columns; column++) {
			const index = row * stride + column;
			values[0] = field[index];
			values[1] = field[index + 1];
			values[2] = field[index + stride + 1];
			values[3] = field[index + stride];
			const low = Math.min(values[0], values[1], values[2], values[3]),
				high = Math.max(values[0], values[1], values[2], values[3]);
			if (high - low > densest) continue;
			for (let level = Math.floor(low) + 1; level <= high; level++) {
				points.length = 0;
				for (let edge = 0; edge < 4; edge++) {
					const next = (edge + 1) % 4,
						a = values[edge] - level,
						b = values[next] - level;
					if (a < 0 === b < 0) continue;
					const t = a / (a - b);
					points.push(
						(column + CORNERS[edge][0] + (CORNERS[next][0] - CORNERS[edge][0]) * t) * cellWidth,
						(row + CORNERS[edge][1] + (CORNERS[next][1] - CORNERS[edge][1]) * t) * cellHeight,
					);
				}
				for (let i = 0; i + 3 < points.length; i += 4) {
					ctx.moveTo(points[i], points[i + 1]);
					ctx.lineTo(points[i + 2], points[i + 3]);
					if (++segments >= budget) return segments;
				}
			}
		}
	}
	return segments;
}
