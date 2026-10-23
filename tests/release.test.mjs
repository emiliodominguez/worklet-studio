import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseOptions, discoverPackages, createPlan, executePlan, registry } from "../scripts/release.mjs";

const packages = [
	{ name: "alpha-worklet", version: "1.1.0", integrity: "sha512-a", archive: "/tmp/alpha.tgz" },
	{ name: "beta-worklet", version: "0.1.0", integrity: "sha512-b", archive: "/tmp/beta.tgz" },
];

test("release defaults to dry-run and rejects ambiguous or invalid arguments", function options() {
	assert.deepEqual(parseOptions([]), { publish: false, tag: "latest", help: false });
	assert.equal(parseOptions(["--publish", "--tag", "next"]).publish, true);
	for (const args of [["--publish", "--dry-run"], ["--tag"], ["--tag", "1.2.3"], ["--registry", "elsewhere"], ["--force"]])
		assert.throws(function invalid() {
			parseOptions(args);
		});
});

test("release discovery excludes private packages and infrastructure", async function discovery() {
	const directory = await mkdtemp(join(tmpdir(), "worklet-discovery-"));
	try {
		for (const [name, isPrivate] of [
			["alpha-worklet", false],
			["internal-worklet", true],
			["core", false],
		]) {
			const path = join(directory, "packages", name);
			await mkdir(path, { recursive: true });
			await writeFile(join(path, "package.json"), JSON.stringify({ name, version: "1.0.0", private: isPrivate }));
		}
		assert.deepEqual(
			(await discoverPackages(directory)).map(function name(item) {
				return item.name;
			}),
			["alpha-worklet"],
		);
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});

test("release resumes only when the exact published tarball matches", async function resume() {
	const plan = await createPlan(packages, {
		lookup: async function lookup(name) {
			return name === "alpha-worklet" ? { versions: ["1.1.0"] } : null;
		},
		lookupIntegrity: async function integrity() {
			return "sha512-a";
		},
	});
	assert.deepEqual(
		plan.map(function action(item) {
			return item.action;
		}),
		["skip", "publish"],
	);
	await assert.rejects(
		createPlan(packages, {
			lookup: async function remote() {
				return { version: "1.1.0" };
			},
			lookupIntegrity: async function other() {
				return "sha512-different";
			},
		}),
		/different contents/,
	);
});

test("release checks ownership and propagates registry failures before publication", async function preflight() {
	await assert.rejects(
		createPlan(packages, {
			identity: "me",
			lookup: async function remote() {
				return { versions: ["0.0.1"], maintainers: [{ name: "someone-else" }] };
			},
		}),
		/does not have publish access/,
	);
	await assert.rejects(
		createPlan(packages, {
			lookup: async function unavailable() {
				throw new Error("registry offline");
			},
		}),
		/registry offline/,
	);
	const plan = await createPlan([packages[0]], {
		identity: "me",
		permissions: { "alpha-worklet": "read-write" },
		lookup: async function remote() {
			return { versions: ["1.0.0"] };
		},
	});
	assert.equal(plan[0].action, "publish");
});

test("dry-run sends no upload command and targets only the planned tarballs", async function dryRun() {
	const calls = [];
	const plan = packages.map(function entry(item) {
		return { ...item, action: "publish" };
	});
	await executePlan(plan, {
		publish: false,
		tag: "next",
		run: async function run(args) {
			calls.push(args);
		},
	});
	assert.equal(calls.length, 2);
	for (const [index, args] of calls.entries()) {
		assert.equal(args[1], packages[index].archive);
		assert.ok(args.includes("--dry-run"));
		assert.ok(args.includes("--ignore-scripts"));
		assert.ok(args.includes(registry));
		assert.equal(args[args.indexOf("--tag") + 1], "next");
	}
});

test("publish stops on the first failure and records partial progress for retry", async function partial() {
	const plan = [...packages, { name: "gamma-worklet", archive: "/tmp/gamma.tgz" }].map(function entry(item) {
		return { ...item, action: "publish" };
	});
	const calls = [],
		snapshots = [];
	await assert.rejects(
		executePlan(plan, {
			publish: true,
			tag: "latest",
			run: async function run(args) {
				calls.push(args);
				if (calls.length === 2) throw new Error("OTP required");
			},
			save: async function save(entries) {
				snapshots.push(
					entries.map(function status(item) {
						return item.status;
					}),
				);
			},
		}),
		/after 1 successful publications/,
	);
	assert.equal(calls.length, 2);
	assert.ok(!calls[0].includes("--dry-run"));
	assert.deepEqual(snapshots.at(-1), ["published", "failed", undefined]);
});
