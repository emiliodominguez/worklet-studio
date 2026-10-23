/** Register the worklet; returns false when CSS Paint is unavailable. @param url Optional hosted worklet URL. @returns Whether the module loaded. */
export declare function register(url?: string | URL): Promise<boolean>;

/** Ease pointer lighting and parallax, honoring reduced motion. @param element Painted element. @returns Cleanup restoring previous inline properties. */
export declare function attachView(element: HTMLElement): () => void;
