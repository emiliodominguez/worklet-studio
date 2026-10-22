import { build, context } from "esbuild";
import { watchFile } from "node:fs";
import { mkdir, copyFile } from "node:fs/promises";

await mkdir("dist", { recursive: true });
const configurations = [
	{ entryPoints: ["src/worklet.ts"], format: "iife", outfile: "worklet.js" },
	{ entryPoints: ["src/worklet.ts"], format: "iife", minify: true, outfile: "worklet.min.js" },
	{ entryPoints: ["src/register.ts"], format: "esm", outfile: "dist/register.js" },
];
const watch = process.argv.includes("--watch");
for (const configuration of configurations) {
	const options = { ...configuration, bundle: true, target: "es2022" };
	if (watch) {
		const compiler = await context(options);
		await compiler.watch();
	} else await build(options);
}
/** Copy the public API declarations into the published output. @returns Completion of the copy. */
async function copyTypes() {
	await copyFile("src/register.d.ts", "dist/register.d.ts");
}
await copyTypes();
if (watch)
	watchFile("src/register.d.ts", function changed() {
		void copyTypes();
	});
