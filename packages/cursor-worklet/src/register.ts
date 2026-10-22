import { loadWorklet } from "../../core/src/register.ts";

/** Register the painter in a supporting browser. SSR-safe; rejects on network or module errors. @param url Optional hosted worklet URL. @returns Whether CSS Paint is supported and the module loaded. */
export function register(url: string | URL = new URL("../worklet.js", import.meta.url)): Promise<boolean> {
	return loadWorklet(url);
}

export interface PointerOptions {
	/** Follow touch pointers too. Defaults to false; never prevents scrolling. */
	touch?: boolean;
}

/** Track pointers in local CSS pixels, with frame-batched updates. @param element Painted element. @param options Pointer behavior. @returns Idempotent cleanup restoring previous inline properties. */
export function attachPointer(element: HTMLElement, options: PointerOptions = {}): () => void {
	const view = element.ownerDocument.defaultView;
	if (!view) return function noop() {};
	const names = ["--cursor-position-x", "--cursor-position-y"];
	const previous = names.map(function read(name) {
		return { value: element.style.getPropertyValue(name), priority: element.style.getPropertyPriority(name) };
	});
	let frame = 0,
		lastX = 0,
		lastY = 0,
		disposed = false;
	/** Write the latest pointer coordinates after layout. */
	function update(): void {
		frame = 0;
		const rect = element.getBoundingClientRect();
		if (rect.width <= 0 || rect.height <= 0) return;
		element.style.setProperty(names[0], String(((lastX - rect.left) * element.offsetWidth) / rect.width));
		element.style.setProperty(names[1], String(((lastY - rect.top) * element.offsetHeight) / rect.height));
	}
	/** Queue the latest pointer position. @param event Pointer event. */
	function move(event: PointerEvent): void {
		if (event.pointerType === "touch" && !options.touch) return;
		lastX = event.clientX;
		lastY = event.clientY;
		if (!frame) frame = view!.requestAnimationFrame(update);
	}
	element.addEventListener("pointermove", move, { passive: true });
	return function cleanup(): void {
		if (disposed) return;
		disposed = true;
		element.removeEventListener("pointermove", move);
		if (frame) view.cancelAnimationFrame(frame);
		for (let i = 0; i < names.length; i++) {
			if (previous[i].value) element.style.setProperty(names[i], previous[i].value, previous[i].priority);
			else element.style.removeProperty(names[i]);
		}
	};
}
