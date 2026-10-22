/** The subset of a style property map consumed by a painter. */
export interface PaintProperties {
	get(name: string): { toString(): string } | string | number | undefined | null;
}

/** Logical CSS-pixel dimensions supplied by the browser. */
export interface PaintSize {
	width: number;
	height: number;
}

/** Only APIs shared by Canvas 2D and PaintRenderingContext2D are used. */
export type PaintContext = Pick<
	CanvasRenderingContext2D,
	| "beginPath"
	| "moveTo"
	| "lineTo"
	| "closePath"
	| "arc"
	| "ellipse"
	| "fill"
	| "stroke"
	| "fillRect"
	| "save"
	| "restore"
	| "translate"
	| "rotate"
	| "createLinearGradient"
	| "createRadialGradient"
	| "fillStyle"
	| "strokeStyle"
	| "globalAlpha"
	| "globalCompositeOperation"
	| "lineWidth"
	| "lineCap"
	| "lineJoin"
>;

export type Painter = (context: PaintContext, size: PaintSize, properties: PaintProperties) => void;

declare global {
	function registerPaint(name: string, painter: { new (): { paint: Painter }; inputProperties: string[] }): void;
	interface CSS {}
}
