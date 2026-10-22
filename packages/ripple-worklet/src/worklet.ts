import { paint, inputProperties } from "./renderer.ts";
import type { PaintContext, PaintSize, PaintProperties } from "../../core/src/types.ts";

if (typeof registerPaint !== "undefined") {
	class Worklet {
		/** CSS inputs that invalidate the painted image. @returns Watched custom properties. */
		static get inputProperties(): string[] {
			return inputProperties;
		}
		/** Delegate to the stateless painter. @param context Paint context. @param size CSS dimensions. @param properties Custom properties. */
		paint(context: PaintContext, size: PaintSize, properties: PaintProperties): void {
			paint(context, size, properties);
		}
	}
	registerPaint("ripple", Worklet);
}
