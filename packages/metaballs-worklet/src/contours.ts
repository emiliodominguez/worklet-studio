import type { PaintContext } from "../../core/src/types.ts";

interface Node {
	x: number;
	y: number;
	neighbors: number[];
}

/** Trace an implicit silhouette with shared grid-edge intersections. The grid boundary must be below the threshold. @param ctx Paint context. @param field Scalar samples. @param columns Grid columns. @param rows Grid rows. @param width CSS width. @param height CSS height. @param level Surface threshold. @returns Number of closed contours. */
export function contourPath(
	ctx: PaintContext,
	field: Float32Array,
	columns: number,
	rows: number,
	width: number,
	height: number,
	level: number,
): number {
	const nodes = new Map<number, Node>();
	const vertical = (rows + 1) * columns;
	for (let row = 0; row < rows; row++) {
		for (let column = 0; column < columns; column++) {
			const index = row * (columns + 1) + column;
			const samples = [field[index], field[index + 1], field[index + columns + 2], field[index + columns + 1]];
			if (Math.min(...samples) >= level || Math.max(...samples) < level) continue;
			const corners = [
				[column, row],
				[column + 1, row],
				[column + 1, row + 1],
				[column, row + 1],
			];
			const ids = [
				row * columns + column,
				vertical + row * (columns + 1) + column + 1,
				(row + 1) * columns + column,
				vertical + row * (columns + 1) + column,
			];
			const crossings: number[] = [];
			for (let edge = 0; edge < 4; edge++) {
				const next = (edge + 1) % 4;
				if (samples[edge] >= level === samples[next] >= level) continue;
				const id = ids[edge];
				crossings.push(id);
				if (!nodes.has(id)) {
					const t = (level - samples[edge]) / (samples[next] - samples[edge]);
					nodes.set(id, {
						x: ((corners[edge][0] + t * (corners[next][0] - corners[edge][0])) / columns) * width,
						y: ((corners[edge][1] + t * (corners[next][1] - corners[edge][1])) / rows) * height,
						neighbors: [],
					});
				}
			}
			if (crossings.length === 4 && samples[0] >= level !== (samples[0] + samples[1] + samples[2] + samples[3]) / 4 >= level)
				crossings.push(crossings.shift()!);
			for (let pair = 0; pair < crossings.length; pair += 2) {
				const a = crossings[pair],
					b = crossings[pair + 1];
				nodes.get(a)!.neighbors.push(b);
				nodes.get(b)!.neighbors.push(a);
			}
		}
	}
	const visited = new Set<number>();
	let count = 0;
	ctx.beginPath();
	for (const [start] of nodes) {
		if (visited.has(start)) continue;
		const loop: Node[] = [];
		let current: number | undefined = start,
			previous = -1;
		while (current !== undefined && !visited.has(current)) {
			const point: Node | undefined = nodes.get(current);
			if (!point) break;
			visited.add(current);
			loop.push(point);
			const next: number | undefined = point.neighbors[0] === previous ? point.neighbors[1] : point.neighbors[0];
			previous = current;
			current = next;
		}
		if (current !== start || loop.length < 3) continue;
		const first = loop[0],
			last = loop[loop.length - 1];
		ctx.moveTo((first.x + last.x) / 2, (first.y + last.y) / 2);
		for (let i = 0; i < loop.length; i++) {
			const point = loop[i],
				next = loop[(i + 1) % loop.length];
			ctx.quadraticCurveTo(point.x, point.y, (point.x + next.x) / 2, (point.y + next.y) / 2);
		}
		ctx.closePath();
		count++;
	}
	return count;
}
