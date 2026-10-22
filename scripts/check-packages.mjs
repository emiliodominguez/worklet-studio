import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { runInNewContext } from "node:vm";

const temporary = await mkdtemp(join(tmpdir(), "worklet-pack-"));
const directories = (await readdir("packages")).filter(function packageDirectory(name) {
	return name.endsWith("-worklet");
});
try {
	const archives = [];
	for (const name of directories) {
		const directory = resolve("packages", name);
		const manifest = JSON.parse(await readFile(join(directory, "package.json"), "utf8"));
		assert.equal(manifest.dependencies, undefined, "Published worklets have no runtime dependencies");
		for (const file of ["worklet.js", "worklet.min.js"]) {
			let registered = false;
			runInNewContext(await readFile(join(directory, file), "utf8"), {
				/** Validate registration as the browser does. @param paintName Registered name. @param painter Worklet class. */
				registerPaint(paintName, painter) {
					assert.equal(paintName, name.replace(/-worklet$/, ""));
					assert.equal(typeof painter.prototype.paint, "function");
					assert.ok(painter.inputProperties.length > 0);
					registered = true;
				},
			});
			assert.ok(registered);
		}
		const packed = JSON.parse(
			execFileSync("npm", ["pack", "--json", "--ignore-scripts", "--pack-destination", temporary], { cwd: directory, encoding: "utf8" }),
		);
		const result = Array.isArray(packed) ? packed[0] : packed[name];
		const files = result.files.map(function file(entry) {
			return entry.path;
		});
		for (const required of ["worklet.js", "worklet.min.js", "dist/register.js", "dist/register.d.ts", "README.md", "LICENSE"])
			assert.ok(files.includes(required), `${name} missing ${required}`);
		assert.ok(
			!files.some(function source(path) {
				return path.startsWith("src/") || path.includes("node_modules");
			}),
		);
		archives.push(join(temporary, result.filename));
		console.log(`${name}@${manifest.version}: ${result.size} bytes packed; both worklet entries register correctly`);
	}
	await writeFile(join(temporary, "package.json"), JSON.stringify({ private: true, type: "module" }));
	execFileSync("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund", ...archives], { cwd: temporary, stdio: "pipe" });
	const imports = directories
		.map(function script(name) {
			return `await import(${JSON.stringify(name)}); if (await (await import(${JSON.stringify(`${name}/register`)})).register() !== false) throw new Error("SSR registration must return false");`;
		})
		.join("\n");
	execFileSync(process.execPath, ["--input-type=module", "-e", imports], { cwd: temporary, stdio: "pipe" });
	console.log("All six tarballs installed and imported successfully in an isolated consumer.");
} finally {
	await rm(temporary, { recursive: true, force: true });
}
