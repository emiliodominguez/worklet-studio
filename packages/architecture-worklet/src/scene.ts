import { cross, normalize, sub } from "./geometry.ts";
import type { Vec3 } from "./geometry.ts";

export type Material = "concrete" | "stone" | "bronze" | "light" | "water" | "sunbeam";

export interface Face {
	points: Vec3[];
	normal: Vec3;
	center: Vec3;
	material: Material;
	level: number;
	wing: number;
	tone: number;
}

/** Add a world-space polygon with outward winding. @param faces Output mesh. @param points Ordered vertices. @param material Surface material. @param level Exploded floor group. @param wing Left/right exploded group. @param tone Surface variation. */
function face(faces: Face[], points: Vec3[], material: Material, level = 0, wing = 0, tone = 1): void {
	const center: Vec3 = [0, 0, 0];
	for (const point of points) for (let axis = 0; axis < 3; axis++) center[axis] += point[axis] / points.length;
	faces.push({ points, normal: normalize(cross(sub(points[1], points[0]), sub(points[2], points[0]))), center, material, level, wing, tone });
}

/** Add a cuboid with consistent outward normals. @param faces Output mesh. @param x Left edge. @param y Bottom edge. @param z Front edge. @param w Width. @param h Height. @param d Depth. @param material Surface material. @param level Floor group. @param wing Side group. */
function box(
	faces: Face[],
	x: number,
	y: number,
	z: number,
	w: number,
	h: number,
	d: number,
	material: Material = "concrete",
	level = 0,
	wing = 0,
): void {
	const p: Vec3[] = [
		[x, y, z],
		[x + w, y, z],
		[x + w, y + h, z],
		[x, y + h, z],
		[x, y, z + d],
		[x + w, y, z + d],
		[x + w, y + h, z + d],
		[x, y + h, z + d],
	];
	for (const indices of [
		[3, 2, 1, 0],
		[4, 5, 6, 7],
		[0, 4, 7, 3],
		[2, 6, 5, 1],
		[3, 7, 6, 2],
		[1, 5, 4, 0],
	]) {
		face(
			faces,
			indices.map(function vertex(index) {
				return p[index];
			}),
			material,
			level,
			wing,
		);
	}
}

/** Build the bounded atrium mesh once; animation transforms its immutable vertices. @returns Architectural surfaces. */
export function createScene(): Face[] {
	const faces: Face[] = [];
	// Segmented receivers keep painter ordering local, even when the camera enters the building.
	for (let z = -22; z < 70; z += 4) {
		for (const [x, width] of [
			[-19, 13.5],
			[5.5, 13.5],
		])
			box(faces, x, -0.65, z, width, 0.65, 4, "stone");
		if (z < 6 || z >= 62) box(faces, -5.5, -0.65, z, 11, 0.65, 4, "stone");
		for (const side of [-1, 1]) {
			for (let level = 0; level < 4; level++) {
				box(faces, side < 0 ? -18.5 : 17.8, level * 7, z, 0.7, 7, 4, "concrete", level, side);
			}
		}
	}
	for (let z = 6; z < 62; z += 4) {
		face(
			faces,
			[
				[-5.5, 0.025, z],
				[-5.5, 0.025, z + 4],
				[5.5, 0.025, z + 4],
				[5.5, 0.025, z],
			],
			"water",
		);
		for (const side of [-1, 1]) {
			box(faces, side < 0 ? -5.85 : 5.5, 0, z, 0.35, 0.16, 4, "stone");
		}
	}
	// Slabs, recessed galleries, slender parapets and warm lights under each floor.
	for (let level = 1; level <= 3; level++) {
		const y = level * 7;
		for (let z = -8; z < 66; z += 6) {
			for (const side of [-1, 1]) {
				const x = side < 0 ? -18 : 9;
				box(faces, x, y - 0.65, z, 9, 0.65, 6, "concrete", level, side);
				box(faces, side < 0 ? -9.22 : 9, y, z, 0.22, 1, 6, "concrete", level, side);
			}
		}
	}
	for (let z = -6; z <= 66; z += 12) {
		for (const side of [-1, 1]) {
			for (let level = 0; level < 4; level++) {
				box(faces, side < 0 ? -11.1 : 10, level * 7, z, 1.1, 7, 1.3, "concrete", level, side);
				box(faces, side < 0 ? -16.2 : 15.3, level * 7, z, 0.9, 7, 1.3, "concrete", level, side);
			}
		}
		box(faces, -18.5, 28, z, 37, 1.1, 1.2, "concrete", 4);
	}
	// Two suspended bridges at different heights interrupt the long perspective.
	for (const [y, z, level] of [
		[17.5, 26, 2.5],
		[7, 38, 1],
	]) {
		for (let x = -9; x < 9; x += 3) {
			box(faces, x, y - 0.65, z, 3, 0.65, 3.2, "concrete", level);
			box(faces, x, y, z, 3, 0.85, 0.18, "concrete", level);
			box(faces, x, y, z + 3, 3, 0.85, 0.18, "concrete", level);
		}
	}
	// Individual treads cast their own edge shading and retain their depth during disassembly.
	for (const [side, start, level] of [
		[-1, 12, 0],
		[1, 30, 1],
	]) {
		for (let step = 0; step < 28; step++) {
			box(faces, side < 0 ? -9 : 6, level * 7 + step * 0.25, start + step * 0.5, 3, 0.28, 0.53, "concrete", level + 0.5, side);
		}
	}
	// Tall end wall with a recessed, illuminated niche.
	for (let y = 0; y < 29; y += 3.625) {
		box(faces, -18, y, 66, 12.5, 3.625, 1.8);
		box(faces, 5.5, y, 66, 12.5, 3.625, 1.8);
		box(faces, -5.5, y, 69, 11, 3.625, 1, "bronze");
	}
	box(faces, -5.5, 23, 66, 11, 6, 3);
	box(faces, -5.4, 0, 68.8, 0.1, 23, 0.1, "light");
	box(faces, 5.3, 0, 68.8, 0.1, 23, 0.1, "light");
	box(faces, -5.3, 22.85, 68.8, 10.6, 0.1, 0.1, "light");
	// A suspended bronze oculus: a genuine closed mesh, reflected in the water below.
	const segments = 80;
	for (let i = 0; i < segments; i++) {
		const a = (i / segments) * Math.PI * 2;
		const b = ((i + 1) / segments) * Math.PI * 2;
		for (let j = 0; j < 8; j++) {
			const c = (j / 8) * Math.PI * 2;
			const d = ((j + 1) / 8) * Math.PI * 2;
			const vertices = [
				[a, c],
				[b, c],
				[b, d],
				[a, d],
			].map(function ring([u, v]): Vec3 {
				const radius = 4.15 + Math.cos(v) * 0.26;
				return [Math.cos(u) * radius, 9.2 + Math.sin(u) * radius, 32 + Math.sin(v) * 0.26];
			});
			face(faces, vertices, "bronze", 0.8);
		}
	}
	box(faces, -0.026, 13.5, 32, 0.052, 14.5, 0.052, "bronze", 1);
	// Narrow roof apertures make diagonal volumes; nested sheets soften their edges.
	for (const z of [9, 21, 33, 45, 57]) {
		for (let layer = 0; layer < 5; layer++) {
			const width = 1.8 + layer * 0.28;
			face(
				faces,
				[
					[-8 - width, 28, z],
					[-8 + width, 28, z],
					[10 + width * 1.6, 0, z + 10.4],
					[10 - width * 1.6, 0, z + 10.4],
				],
				"sunbeam",
			);
		}
	}
	return faces;
}
