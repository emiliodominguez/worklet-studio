const loads = new Map<string, Promise<boolean>>();

/** Load a paint module once, with an SSR-safe unsupported-browser result. Failed loads can be retried. @param url Module URL. @returns Whether the browser supports and loaded CSS Paint. */
export function loadWorklet(url: string | URL): Promise<boolean> {
	const css = globalThis.CSS as typeof CSS & { paintWorklet?: { addModule(url: string): Promise<void> } };
	if (!css?.paintWorklet) return Promise.resolve(false);
	const key = String(url);
	const existing = loads.get(key);
	if (existing) return existing;
	const promise = css.paintWorklet
		.addModule(key)
		.then(function loaded() {
			return true;
		})
		.catch(function failed(error: unknown) {
			loads.delete(key);
			throw error;
		});
	loads.set(key, promise);
	return promise;
}
