import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { experiments } from "../apps/playground/src/catalog.ts";

const root = resolve(import.meta.dirname, "..");
const directory = resolve(root, "artifacts/codepens");
const statePath = resolve(directory, "published.json");
const collection = "bNWgYw";
const args = process.argv.slice(2);
const publish = args.includes("--publish");
const only = args
	.find(function filter(argument) {
		return argument.startsWith("--only=");
	})
	?.slice(7);
const key =
	process.env.CODEPEN_API_KEY || (process.env.CODEPEN_API_KEY_FILE ? (await readFile(process.env.CODEPEN_API_KEY_FILE, "utf8")).trim() : "");
let state;
try {
	state = JSON.parse(await readFile(statePath, "utf8"));
} catch (error) {
	if (error.code !== "ENOENT") throw error;
	const manifest = JSON.parse(await readFile(resolve(root, "docs/codepens.json"), "utf8"));
	state = { collection, calls: [], pens: manifest.pens };
}

/** Persist progress before making the next external change. */
async function save() {
	await mkdir(directory, { recursive: true });
	await writeFile(statePath, JSON.stringify(state, null, "\t") + "\n");
}

/** Make one API request without automatic retries or credential logging. @param {string} method HTTP method. @param {string} path API path. @param {object} [body] Request body. @returns {Promise<object>} API result. */
async function api(method, path, body) {
	const recent = state.calls.filter(function withinHour(call) {
		return Date.now() - Date.parse(call.time) < 3_600_000;
	});
	if (recent.length >= 85) throw new Error("Stopped at the local 85-call hourly budget, leaving room for manual API work.");
	state.calls.push({ time: new Date().toISOString(), method, path });
	await save();
	const response = await fetch(`https://api.codepen.io/v2${path}`, {
		method,
		headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
		body: body ? JSON.stringify(body) : undefined,
		redirect: "error",
		signal: AbortSignal.timeout(85_000),
	});
	const data = response.status === 204 ? {} : await response.json();
	if (!response.ok) {
		const error = new Error(`CodePen ${method} ${path}: ${response.status} ${data.code || ""} ${data.message || ""}`);
		error.status = response.status;
		throw error;
	}
	return data;
}

const prepared = [];
for (const effect of experiments) {
	if (only && effect.id !== only) continue;
	const payload = JSON.parse(await readFile(resolve(directory, effect.id, "prefill.json"), "utf8"));
	if (JSON.stringify(payload).includes("\u2014")) throw new Error(`${effect.id}: em dash found.`);
	if (/registerPaint|new Blob|function attachView|function attachPointer/.test(payload.js))
		throw new Error(`${effect.id}: inline renderer or pointer helper found.`);
	if (!payload.js.includes("https://cdn.jsdelivr.net/npm/")) throw new Error(`${effect.id}: missing npm import.`);
	const files = [];
	for (const path of ["index.html", "style.css", "script.js"])
		files.push({ path, content: await readFile(resolve(directory, effect.id, path), "utf8") });
	prepared.push({
		id: effect.id,
		title: payload.title,
		description: payload.description,
		tags: ["css", "houdini", "worklet-studio"],
		access: "Public",
		files,
		wait: 45,
	});
}

if (!publish) {
	console.log(`Ready: ${prepared.length} formatted npm-based Pens. Use --publish with CODEPEN_API_KEY or CODEPEN_API_KEY_FILE.`);
} else {
	if (!key) throw new Error("Set CODEPEN_API_KEY or CODEPEN_API_KEY_FILE.");
	if (!state.checkedCollection) {
		const target = await api("GET", `/collections/${collection}`);
		if (target.id !== collection || target.title !== "CSS Houdini") throw new Error("Collection identity mismatch.");
		state.checkedCollection = true;
		await save();
	}
	for (const pen of prepared) {
		let published = state.pens[pen.id];
		if (published?.pendingCreation) throw new Error(`${pen.id}: a prior create request has an uncertain result. Reconcile before retrying.`);
		if (!published) {
			state.pens[pen.id] = { pendingCreation: true, title: pen.title };
			await save();
			const { id, ...body } = pen;
			let result;
			try {
				result = await api("POST", "/pens", body);
			} catch (error) {
				// A rejected request did not create a Pen. Network failures remain uncertain.
				if (error.status >= 400 && error.status < 500) {
					delete state.pens[id];
					await save();
				}
				throw error;
			}
			published = state.pens[id] = {
				id: result.id,
				title: result.title,
				url: result.urls.editor,
				preview: result.urls.preview,
				build: result.build,
				inCollection: false,
			};
			await save();
			console.log(`${id}: created ${published.url}, build ${result.build.status}`);
		}
		if (published.build && published.build.status !== "Success")
			throw new Error(`${pen.id}: build ${published.build.status}. Inspect the recorded build before continuing.`);
		if (!published.inCollection) {
			const updated = await api("PUT", `/collections/${collection}/pens/${published.id}`);
			published.inCollection = true;
			await save();
			console.log(`${pen.id}: added to ${updated.title} (${updated.items_count} items)`);
		}
	}
	if (!only) {
		const members = await api("GET", `/collections/${collection}/pens?per_page=100`);
		for (const pen of Object.values(state.pens))
			if (
				!members.some(function matches(member) {
					return member.id === pen.id;
				})
			)
				throw new Error(`Missing collection member ${pen.id}`);
		state.verifiedAt = new Date().toISOString();
		await save();
		console.log(`Verified all ${Object.keys(state.pens).length} Pens in the collection. ${state.calls.length} API calls recorded.`);
	}
}
