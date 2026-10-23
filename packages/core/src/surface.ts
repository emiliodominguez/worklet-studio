import type { PaintContext, PaintSize } from "./types.ts";

export type SurfaceShader = (u: number, v: number) => string;

/** Shade a continuous surface with bounded gradient scanlines using only Paint API operations. @param ctx Paint context. @param size Surface dimensions. @param shade Material sampler in normalized coordinates. @param resolution Maximum samples along either axis. */
export function surface(ctx: PaintContext, size: PaintSize, shade: SurfaceShader, resolution = 144): void {
	const columns = Math.max(32, Math.min(resolution, Math.ceil(size.width / 3)));
	const rows = Math.max(32, Math.min(resolution, Math.ceil(size.height / 3)));
	const height = size.height / rows;
	const pixel = Math.max(1, size.height / 1200);
	let previous: CanvasGradient | undefined;
	ctx.save();
	for (let row = 0; row <= rows; row++) {
		const gradient = ctx.createLinearGradient(0, 0, size.width, 0);
		for (let column = 0; column <= columns; column++) gradient.addColorStop(column / columns, shade(column / columns, row / rows));
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

/** Convert a continuous spectral palette and exposure into a bounded display color. @param hue Base hue in degrees. @param light Linear light level. @param saturation Color strength. @param alpha Opacity. @returns CSS color. */
export function spectrum(hue: number, light: number, saturation = 0.75, alpha = 1): string {
	const h = hue / 30;
	const channels: number[] = [];
	for (const offset of [0, 8, 4]) {
		const k = (((h + offset) % 12) + 12) % 12;
		const tint = Math.max(-1, Math.min(k - 3, 9 - k, 1));
		const linear = Math.max(0, light * (1 - saturation * tint));
		channels.push(Math.round(255 * Math.pow(1 - Math.exp(-linear), 0.8)));
	}
	return `rgba(${channels.join(",")},${Math.max(0, Math.min(1, alpha))})`;
}

/** Reflect a studio environment in a normal-mapped material. @param nx Unit normal x. @param ny Unit normal y. @param nz Unit normal z. @param hue Material hue. @param intensity Exposure. @param metallic Reflectivity. @param lightX Moving light position. @param lightY Moving light position. @returns Shaded CSS color. */
export function material(
	nx: number,
	ny: number,
	nz: number,
	hue: number,
	intensity: number,
	metallic: number,
	lightX = -0.45,
	lightY = -0.65,
): string {
	const length = Math.hypot(lightX, lightY, 1.5);
	const diffuse = Math.max(0, (nx * lightX + ny * lightY + nz * 1.5) / length);
	const specular = Math.pow(Math.max(0, (nx * lightX + ny * lightY + nz * 2.5) / Math.hypot(lightX, lightY, 2.5)), 65);
	const reflectedY = 2 * ny * nz;
	const softbox = Math.exp(-Math.pow((reflectedY + 0.48) * 8, 2)) * (0.35 + 0.65 * nz);
	const edge = Math.pow(1 - Math.max(0, nz), 3);
	const light = (0.045 + diffuse * 0.28 + softbox * metallic * 1.4 + specular * 2.8 + edge * 0.65) * intensity;
	return spectrum(hue + nx * 35 + ny * 25 + edge * 65, light, Math.max(0.05, 0.85 - specular * 0.7 - softbox * 0.65), 1);
}
