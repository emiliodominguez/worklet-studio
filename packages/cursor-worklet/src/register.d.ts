/** Register the worklet; returns false when CSS Paint is unavailable. @param url Optional hosted worklet URL. @returns Whether the module loaded. */
export declare function register(url?: string | URL): Promise<boolean>;
export interface PointerOptions {
	touch?: boolean;
}
/** Track a local pointer. @param element Painted element. @param options Pointer behavior. @returns Cleanup restoring previous inline properties. */
export declare function attachPointer(element: HTMLElement, options?: PointerOptions): () => void;
