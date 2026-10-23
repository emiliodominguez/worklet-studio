import { loadWorklet } from "../../core/src/register.ts";
export { attachArchitecture, attachArchitecture as attachView } from "./interaction.ts";
export type { ArchitectureOptions } from "./interaction.ts";

/** Load the architecture painter. @param url Hosted module URL. @returns False when CSS Paint is unavailable, otherwise true after loading. */
export function register(url: string | URL = new URL("../worklet.js", import.meta.url)): Promise<boolean> {
	return loadWorklet(url);
}
