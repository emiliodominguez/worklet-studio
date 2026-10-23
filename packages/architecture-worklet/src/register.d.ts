export interface ArchitectureOptions {
	/** Opt in to wheel navigation on a dedicated full-screen surface. Default false preserves page scrolling. */
	wheel?: boolean;
}

/** Load the painter; safe during SSR. @param url Hosted module URL. @returns Whether the painter loaded. */
export declare function register(url?: string | URL): Promise<boolean>;

/** Ease camera tracking, hold-to-separate and optional wheel navigation. @param element Painted element. @param options Interaction settings. @returns Idempotent cleanup restoring inline properties. */
export declare function attachArchitecture(element: HTMLElement, options?: ArchitectureOptions): () => void;

export { attachArchitecture as attachView };
