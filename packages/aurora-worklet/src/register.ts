import { loadWorklet } from "../../core/src/register.ts";

/** Register the painter in a supporting browser. SSR-safe; rejects on network or module errors. @param url Optional hosted worklet URL. @returns Whether CSS Paint is supported and the module loaded. */
export function register(url: string | URL = new URL("../worklet.js", import.meta.url)): Promise<boolean> {
	return loadWorklet(url);
}
