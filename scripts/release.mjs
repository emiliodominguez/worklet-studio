import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const registry = "https://registry.npmjs.org/";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Parse a deliberately small release interface. @param args CLI arguments. @returns Validated mode and npm tag. */
export function parseOptions(args) {
	let publish = false,
		mode,
		tag = "latest",
		help = false;
	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		if (arg === "--publish" || arg === "--dry-run") {
			if (mode && mode !== arg) throw new Error("Choose either --publish or --dry-run.");
			mode = arg;
			publish = arg === "--publish";
		} else if (arg === "--tag") {
			tag = args[++i];
			if (!tag || !/^[a-z][a-z0-9._-]*$/i.test(tag) || /^v?\d/i.test(tag)) throw new Error("Provide a tag such as latest, next, or beta.");
		} else if (arg === "--help") help = true;
		else throw new Error(`Unknown release argument: ${arg}`);
	}
	return { publish, tag, help };
}

/** Select public worklet packages, never private infrastructure or apps. @param directory Repository root. @returns Sorted package manifests and paths. */
export async function discoverPackages(directory) {
	const packages = [];
	for (const entry of await readdir(join(directory, "packages"), { withFileTypes: true })) {
		if (!entry.isDirectory() || !entry.name.endsWith("-worklet")) continue;
		const cwd = join(directory, "packages", entry.name);
		const manifest = JSON.parse(await readFile(join(cwd, "package.json"), "utf8"));
		if (manifest.private) continue;
		if (manifest.name !== entry.name || !/^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?(?:\+[a-z0-9.-]+)?$/i.test(manifest.version || ""))
			throw new Error(`Invalid worklet name or version in ${entry.name}.`);
		if (manifest.publishConfig?.registry && manifest.publishConfig.registry !== registry)
			throw new Error(`${manifest.name} overrides the npm registry; remove that override before this release.`);
		packages.push({ name: manifest.name, version: manifest.version, cwd });
	}
	packages.sort(function byName(a, b) {
		return a.name.localeCompare(b.name);
	});
	if (!packages.length) throw new Error("No public worklet packages were found.");
	return packages;
}

/** Run npm with argument arrays, preserving interactive authentication for publication. @param args npm arguments. @param options Working directory and I/O behavior. @returns Parsed JSON, or null for an allowed missing package. */
function npm(args, { cwd = root, interactive = false, allowMissing = false } = {}) {
	const executable = process.env.npm_execpath;
	const result = spawnSync(executable ? process.execPath : "npm", executable ? [executable, ...args] : args, {
		cwd,
		encoding: "utf8",
		stdio: interactive ? "inherit" : "pipe",
		maxBuffer: 16 * 1024 * 1024,
		env: { ...process.env, npm_config_update_notifier: "false" },
	});
	if (result.error) throw result.error;
	let data;
	if (!interactive && result.stdout.trim()) {
		try {
			data = JSON.parse(result.stdout);
		} catch {
			/* A failed CLI may emit non-JSON diagnostics. */
		}
	}
	if (result.status !== 0) {
		if (allowMissing && data?.error?.code === "E404") return null;
		const reason = data?.error?.summary || data?.error?.code || result.stderr?.trim() || `exit ${result.status ?? result.signal}`;
		throw new Error(`npm ${args[0]} failed: ${reason}`);
	}
	if (!interactive && data === undefined) throw new Error(`npm ${args[0]} returned no valid JSON.`);
	return data;
}

/** Preflight every package before any publication; identical published tarballs are resumable. @param packages Packed local packages. @param services Registry readers and optional identity. @returns Complete publish/skip plan. */
export async function createPlan(packages, { lookup, lookupIntegrity, identity, permissions = {} }) {
	const plan = [];
	for (const item of packages) {
		const remote = await lookup(item.name);
		if (remote?.versions?.includes(item.version) || remote?.version === item.version) {
			const integrity = await lookupIntegrity(item.name, item.version);
			if (!integrity || integrity !== item.integrity)
				throw new Error(`${item.name}@${item.version} already exists with different contents. Bump its version before publishing.`);
			plan.push({ ...item, action: "skip", status: "already published" });
			continue;
		}
		if (
			identity &&
			remote &&
			permissions[item.name] !== "read-write" &&
			!remote.maintainers?.some(function owner(user) {
				return user.name === identity;
			})
		)
			throw new Error(`${identity} does not have publish access to ${item.name}. No packages were published.`);
		plan.push({ ...item, action: "publish", status: "pending" });
	}
	return plan;
}

/** Publish sequentially or ask npm to dry-run the exact packed files. @param plan Fully preflighted package plan. @param options Mode, tag, npm runner, and journal writer. @returns Number of successful operations. */
export async function executePlan(plan, { publish, tag, run, save = async function noop() {} }) {
	let completed = 0;
	for (const item of plan) {
		if (item.action === "skip") continue;
		const args = ["publish", item.archive, "--ignore-scripts", "--access", "public", "--tag", tag, "--registry", registry];
		if (!publish) args.push("--dry-run");
		try {
			await run(args);
			item.status = publish ? "published" : "dry-run passed";
			completed++;
			await save(plan);
		} catch (error) {
			item.status = "failed";
			await save(plan);
			throw new Error(
				`${item.name}@${item.version} failed after ${completed} successful ${publish ? "publications" : "dry runs"}. Fix the error and rerun; identical published versions will be skipped. ${error.message}`,
			);
		}
	}
	return completed;
}

/** Pack, preflight, and release the repository's public worklets. @param args Command-line arguments. */
export async function main(args) {
	const options = parseOptions(args);
	if (options.help) {
		console.log(
			"npm run release:dry-run [-- --tag next]\nnpm run release:publish [-- --tag next]\nDirect script defaults to --dry-run and expects built packages. Registry: " +
				registry,
		);
		return;
	}
	const packages = await discoverPackages(root);
	const releases = join(root, "artifacts", "releases");
	await mkdir(releases, { recursive: true });
	const output = await mkdtemp(join(releases, "release-"));
	console.log(`Packing ${packages.length} public worklets into ${output}`);
	for (const item of packages) {
		const packed = npm(["pack", "--json", "--ignore-scripts", "--pack-destination", output], { cwd: item.cwd });
		const result = Array.isArray(packed) ? packed[0] : packed[item.name];
		if (!result?.integrity || !result.filename || result.name !== item.name || result.version !== item.version)
			throw new Error(`Invalid pack output for ${item.name}.`);
		for (const path of ["worklet.js", "worklet.min.js", "dist/register.js", "dist/register.d.ts", "README.md", "LICENSE"])
			if (
				!result.files.some(function required(file) {
					return file.path === path;
				})
			)
				throw new Error(`${item.name} is missing ${path}; run npm run build.`);
		Object.assign(item, { archive: join(output, result.filename), integrity: result.integrity, bytes: result.size });
	}
	let identity, permissions;
	if (options.publish) {
		identity = npm(["whoami", "--json", "--registry", registry]);
		if (typeof identity !== "string" || !identity) throw new Error("Run npm login before publishing.");
		permissions = npm(["access", "list", "packages", identity, "--json", "--registry", registry]);
		console.log(`Publishing as ${identity} with tag ${options.tag}.`);
	}
	const plan = await createPlan(packages, {
		identity,
		permissions,
		/** Read public package metadata. @param name Package name. @returns Registry metadata or null. */
		lookup: function lookup(name) {
			return npm(["view", name, "--json", "--registry", registry], { allowMissing: true });
		},
		/** Read immutable version integrity. @param name Package name. @param version Exact version. @returns Integrity string. */
		lookupIntegrity: function lookupIntegrity(name, version) {
			return npm(["view", `${name}@${version}`, "dist.integrity", "--json", "--registry", registry]);
		},
	});
	for (const item of plan) console.log(`${item.action.toUpperCase()} ${item.name}@${item.version} (${item.bytes} bytes)`);
	const report = join(output, "release.json");
	/** Persist progress without any credentials. @param entries Current package outcomes. */
	async function save(entries) {
		await writeFile(
			report,
			JSON.stringify({ mode: options.publish ? "publish" : "dry-run", registry, tag: options.tag, packages: entries }, null, "\t") + "\n",
		);
	}
	await save(plan);
	const completed = await executePlan(plan, {
		...options,
		save,
		run: function publish(args) {
			npm(args, { interactive: true });
		},
	});
	console.log(`${completed} ${options.publish ? "published" : "dry runs passed"}; ${plan.length - completed} already published. Report: ${report}`);
	if (!options.publish)
		console.log(
			"Nothing was uploaded. Login, then run npm run release:publish to publish. Ownership and authentication are checked by publish mode.",
		);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	try {
		await main(process.argv.slice(2));
	} catch (error) {
		console.error(error.message);
		process.exitCode = 1;
	}
}
