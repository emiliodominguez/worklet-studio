import { commonProperties, controls, drawable, glow, number, TAU } from "../../core/src/index.ts";
import type { PaintContext, PaintProperties, PaintSize } from "../../core/src/types.ts";
export const inputProperties = [
	...commonProperties,
	"--kaleidoscope-segments",
	"--kaleidoscope-layers",
	"--kaleidoscope-twist",
	"--kaleidoscope-radius",
];

interface Point {
	x: number;
	y: number;
}

/** Locate a vertex on a mirrored, rotating crystal layer. @param radius Outer radius. @param layer Radial fraction. @param angle Sector angle. @param phase Loop phase. @param twist Layer rotation. @returns Vertex coordinates. */
function vertex(radius: number, layer: number, angle: number, phase: number, twist: number): Point {
	const r = radius * Math.pow(layer, 1.15) * (0.92 + Math.sin(layer * 12 + phase) * 0.08);
	const a = angle + Math.sin(phase + layer * 3) * twist * layer * 0.35;
	return { x: Math.cos(a) * r, y: Math.sin(a) * r };
}

/** Paint a mirrored crystal with moving facets and fine spectral seams. @param ctx Paint context. @param size CSS dimensions. @param properties CSS inputs. */
export function paint(ctx: PaintContext, size: PaintSize, properties: PaintProperties): void {
	if (!drawable(size)) return;
	const { phase, hue, intensity, seed, viewX, viewY } = controls(properties);
	const segments = Math.floor(number(properties, "--kaleidoscope-segments", 12, 4, 24));
	const layers = Math.floor(number(properties, "--kaleidoscope-layers", 10, 3, 18));
	const twist = number(properties, "--kaleidoscope-twist", 1.2, 0, 3);
	const radius = Math.min(size.width, size.height) * 0.46 * number(properties, "--kaleidoscope-radius", 1, 0.4, 1.4);
	const time = phase + seed * 0.01;
	ctx.save();
	ctx.translate(size.width * (0.5 + viewX * 0.035), size.height * (0.5 + viewY * 0.035));
	ctx.rotate(viewX * 0.1);
	glow(ctx, 0, 0, radius * 1.25, `hsla(${hue}, 85%, 50%, ${intensity * 0.1})`);
	for (let layer = layers - 1; layer >= 0; layer--) {
		const inner = layer / layers,
			outer = (layer + 1) / layers;
		for (let sector = 0; sector < segments; sector++) {
			const angle = (sector / segments) * TAU,
				next = ((sector + 1) / segments) * TAU;
			const a = vertex(radius, inner, angle, time, twist),
				b = vertex(radius, outer, angle, time, twist);
			const c = vertex(radius, outer, next, time, twist),
				d = vertex(radius, inner, next, time, twist);
			for (let facet = 0; facet < 2; facet++) {
				const points = facet ? [a, c, d] : [a, b, c];
				const light = 0.5 + Math.sin(time + layer * 0.7 + facet * Math.PI + Math.cos(angle - viewX) * 0.9) * 0.5;
				const glint = Math.pow(Math.max(0, Math.sin(time + layer * 0.7 + angle * 2)), 22);
				const gradient = ctx.createLinearGradient(a.x, a.y, c.x, c.y);
				gradient.addColorStop(0, `hsla(${hue + layer * 6 + facet * 25}, 85%, ${10 + light * intensity * 30}%, 0.95)`);
				gradient.addColorStop(
					0.52,
					`hsla(${hue + layer * 7}, ${85 - glint * 65}%, ${Math.min(98, 23 + light * 25 + glint * 50 * intensity)}%, 0.95)`,
				);
				gradient.addColorStop(0.65, `hsla(${hue + layer * 7 + facet * 20}, 90%, ${25 + light * intensity * 25}%, 0.9)`);
				gradient.addColorStop(1, `hsla(${hue + 55 + layer * 7}, 85%, ${40 + light * intensity * 40}%, 0.9)`);
				ctx.fillStyle = gradient;
				ctx.strokeStyle = `hsla(${hue + layer * 15}, 85%, 85%, ${intensity * (0.12 + light * 0.2)})`;
				ctx.lineWidth = 0.65;
				ctx.beginPath();
				ctx.moveTo(points[0].x, points[0].y);
				ctx.lineTo(points[1].x, points[1].y);
				ctx.lineTo(points[2].x, points[2].y);
				ctx.closePath();
				ctx.fill();
				ctx.stroke();
				if (glint > 0.6 && layer % 3 === 0) glow(ctx, c.x, c.y, radius * 0.045, `hsla(${hue + 30}, 65%, 90%, ${glint * intensity * 0.5})`);
			}
		}
	}
	glow(ctx, 0, 0, radius * 0.18, `hsla(${hue + 50}, 90%, 85%, ${intensity * 0.4})`);
	ctx.restore();
}
