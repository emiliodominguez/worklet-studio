/** Register the painter. @param url Optional hosted module URL. @returns Whether CSS Paint is supported and the module loaded. */
export declare function register(url?: string | URL): Promise<boolean>;
export interface PointerOptions {
	/** Follow touch pointers. Default false. */
	touch?: boolean;
	/** Follow fraction per 60 Hz frame, 0.05–1. Default 1. */
	smoothing?: number;
	/** Bounded history length, 2–32. Default 24. */
	trail?: number;
}
/** Track local position, trail, speed, and press. @param element Painted element. @param options Pointer behavior. @returns Cleanup restoring all previous inline values. */
export declare function attachPointer(element: HTMLElement, options?: PointerOptions): () => void;
