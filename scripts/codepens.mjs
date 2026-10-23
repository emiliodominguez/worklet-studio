import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { format } from "prettier";
import { experiments } from "../apps/playground/src/catalog.ts";
import { icon, brandMark } from "../apps/playground/src/icons.ts";

const root = resolve(import.meta.dirname, "..");
const output = resolve(root, "artifacts/codepens");
await mkdir(output, { recursive: true });

/** Escape text for HTML and form attributes. @param {unknown} value Text. @returns {string} Safe HTML. */
function escape(value) {
	return String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

const styles = `@property --worklet-time {
	syntax: "<number>";
	inherits: false;
	initial-value: 0;
}
* { box-sizing: border-box; }
html, body { margin: 0; min-height: 100%; }
body { color: #eeeef2; background-color: #06080d; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
button, select, input { font: inherit; }
button, select { color: inherit; border: 1px solid #ffffff26; background-color: #10131bd9; border-radius: 8px; }
button { display: inline-flex; align-items: center; gap: 8px; padding: 10px 12px; cursor: pointer; }
button:hover { border-color: #ffffff70; }
button:focus-visible, select:focus-visible, input:focus-visible, summary:focus-visible { outline: 2px solid #c5fa6a; outline-offset: 4px; }
svg { width: 18px; height: 18px; flex-shrink: 0; }
.scene { min-height: 100svh; position: relative; isolation: isolate; overflow: hidden; background-color: #06080d; background-image: radial-gradient(ellipse at 40% 40%, #172437, #070911 70%); }
.scene.ready { background-image: paint(EFFECT); animation: worklet-clock DURATIONs linear infinite; }
.scene.paused { animation-play-state: paused; }
@keyframes worklet-clock { to { --worklet-time: 1; } }
.topbar { position: absolute; inset: 0 0 auto; padding: 26px 30px; display: flex; align-items: center; justify-content: space-between; gap: 20px; z-index: 2; background-image: linear-gradient(#06080db3, transparent); }
.brand { display: flex; align-items: center; gap: 11px; font-size: 12px; font-weight: 650; letter-spacing: .08em; text-transform: uppercase; }
.brand svg { width: 27px; height: 27px; color: #d2fa86; }
.badge { font: 10px ui-monospace, monospace; letter-spacing: .08em; text-transform: uppercase; color: #c5c9d2; }
.bottom { position: absolute; inset: auto 0 0; display: flex; align-items: flex-end; justify-content: space-between; gap: 30px; padding: 95px 30px 30px; background-image: linear-gradient(transparent, #06080df2); pointer-events: none; }
.copy { max-width: 420px; text-shadow: 0 2px 24px #000; }
.eyebrow { color: #c9f987; letter-spacing: .13em; text-transform: uppercase; font-size: 10px; font-weight: 650; }
h1 { font-size: clamp(38px, 6vw, 80px); font-weight: 470; line-height: .98; letter-spacing: -.055em; margin: 12px 0; }
.subtitle { font-size: clamp(14px, 2vw, 19px); margin: 0 0 10px; color: #edeef3; }
.hint { color: #a9b0be; font-size: 11px; line-height: 1.6; margin: 0; }
.panel { width: 245px; flex-shrink: 0; padding: 16px; border: 1px solid #ffffff1c; border-radius: 12px; background-color: #0b0f17df; backdrop-filter: blur(16px); pointer-events: auto; }
.preset-label { display: block; color: #a4acbd; font-size: 10px; letter-spacing: .12em; text-transform: uppercase; margin-bottom: 8px; }
select { width: 100%; padding: 9px; font-size: 12px; }
details { margin-top: 14px; }
summary { display: flex; align-items: center; justify-content: space-between; list-style: none; font-size: 11px; color: #b6bdcc; cursor: pointer; }
summary::-webkit-details-marker { display: none; }
details[open] summary svg { transform: rotate(90deg); }
.sliders { display: grid; gap: 13px; margin-top: 16px; }
.control { display: grid; grid-template-columns: 1fr auto; gap: 7px; font-size: 11px; color: #b6bdcc; }
output { color: #edf2ff; font-family: ui-monospace, monospace; }
input { grid-column: 1 / -1; width: 100%; margin: 0; accent-color: #d2fa86; cursor: pointer; }
.status { position: absolute; inset: 40% 12% auto; text-align: center; line-height: 1.7; font-size: 14px; color: #cbd2e1; }
.status:empty { display: none; }
@media (max-width: 580px) {
	.topbar { padding: 18px; }
	.badge { display: none; }
	.bottom { padding: 80px 18px 20px; gap: 18px; flex-wrap: wrap; }
	.copy { max-width: 100%; }
	.panel { width: 100%; padding: 12px; }
	.panel-head { display: grid; grid-template-columns: auto 1fr; gap: 16px; align-items: center; }
	.preset-label { margin: 0; }
	details { margin-top: 10px; }
	.sliders { grid-template-columns: 1fr 1fr; }
	.scene { min-height: max(620px, 100svh); }
}
@media (prefers-reduced-motion: reduce) { .scene.ready { animation: none; --worklet-time: .18; } }
`;

const links = [];
for (const [index, effect] of experiments.entries()) {
	const directory = resolve(output, effect.id);
	await mkdir(directory, { recursive: true });
	const defaults = { "--worklet-seed": 42, "--worklet-hue": 220, "--worklet-intensity": 1 };
	for (const control of effect.controls) defaults[control.property] = control.value;
	let html = `<main class="scene" aria-label="${escape(effect.name)} interactive CSS paint experiment">
	<header class="topbar">
		<div class="brand">${brandMark()}<span>Worklet Studio</span></div>
		<span class="badge">CSS Paint API / ${String(index + 1).padStart(2, "0")}</span>
		<button id="pause" type="button" aria-pressed="false">${icon("pause")}<span>Pause</span></button>
	</header>
	<p class="status" role="status">Loading the paint worklet…</p>
	<footer class="bottom">
		<div class="copy"><span class="eyebrow">${escape(effect.name)} worklet</span><h1>${escape(effect.subtitle)}</h1><p class="subtitle">Painted by CSS. Moved by you.</p><p class="hint">${escape(effect.hint)}</p></div>
		<section class="panel" aria-label="Effect controls">
			<div class="panel-head"><label class="preset-label" for="preset">Material / preset</label><select id="preset">${effect.presets
				.map(function option(preset, i) {
					return `<option value="${i}">${escape(preset.name)}</option>`;
				})
				.join("")}</select></div>
			<details><summary>Tune the effect ${icon("chevron")}</summary><div class="sliders">${[
				...effect.controls,
				{ property: "--worklet-hue", label: "Hue", min: 0, max: 360, step: 1, value: 220 },
			]
				.map(function slider(control) {
					return `<label class="control">${escape(control.label)}<output>${control.value}</output><input type="range" data-property="${control.property}" min="${control.min}" max="${control.max}" step="${control.step}" value="${control.value}" aria-label="${escape(control.label)}"></label>`;
				})
				.join("")}</div></details>
		</section>
	</footer>
</main>`;
	let css = styles.replace("paint(EFFECT)", `paint(${effect.id})`).replace("DURATIONs", effect.id === "cursor" ? "8s" : "24s");
	if (effect.id === "cursor") css = css.replace(".scene {", ".scene { user-select: none;");
	const pkg = JSON.parse(await readFile(resolve(root, `packages/${effect.id}-worklet/package.json`), "utf8"));
	const packageUrl = `https://cdn.jsdelivr.net/npm/${pkg.name}@${pkg.version}`;
	let js = `// ${effect.name} worklet
// Renderer and pointer tracking come from ${effect.id}-worklet on npm.
// This Pen only configures CSS properties and connects the controls.

const scene = document.querySelector(".scene");
const status = document.querySelector(".status");
const presets = ${JSON.stringify(effect.presets, null, "\t")};
const defaults = ${JSON.stringify(defaults, null, "\t")};
const propertyNames = new Set([...Object.keys(defaults), ...presets.flatMap(function keys(preset) { return Object.keys(preset.values); })]);
const pause = document.querySelector("#pause");
let paused = false;
/** Apply a complete preset without carrying settings over from the previous one. @param {number} index Preset index. */
function applyPreset(index) {
	for (const property of propertyNames) scene.style.removeProperty(property);
	const values = { ...defaults, ...presets[index].values };
	for (const [property, value] of Object.entries(values)) scene.style.setProperty(property, String(value));
	for (const input of document.querySelectorAll("input[data-property]")) {
		input.value = values[input.dataset.property];
		input.previousElementSibling.value = input.value;
	}
}

document.querySelector("#preset").addEventListener("change", function change(event) { applyPreset(Number(event.target.value)); });

for (const input of document.querySelectorAll("input[data-property]")) {
	input.addEventListener("input", function adjust() {
		scene.style.setProperty(input.dataset.property, input.value);
		input.previousElementSibling.value = input.value;
	});
}

pause.addEventListener("click", function togglePause() {
	paused = !paused;
	scene.classList.toggle("paused", paused);
	pause.setAttribute("aria-pressed", String(paused));
	pause.querySelector("span").textContent = paused ? "Play" : "Pause";
	pause.querySelector("path").setAttribute("d", paused ? "m8 4 12 8-12 8V4Z" : "M8 5v14M16 5v14");
});

applyPreset(0);

/** Load the published npm renderer and attach pointer interaction. */
async function start() {
	if (!("paintWorklet" in CSS)) {
		status.textContent = "This experiment needs the CSS Paint API. Open it in Chrome or Edge to see the animated material.";
		return;
	}
	try {
		const { register, ${effect.id === "cursor" ? "attachPointer" : "attachView"} } = await import("${packageUrl}/dist/register.js");

		await register("${packageUrl}/worklet.js");
		scene.classList.add("ready");
		status.textContent = "";
		const cleanup = ${effect.id === "cursor" ? "attachPointer(scene, { touch: true, smoothing: 0.16, trail: 28 })" : "attachView(scene)"};
		window.addEventListener("pagehide", cleanup, { once: true });
	} catch (error) {
		status.textContent = "The worklet could not load. Please reload this Pen in Chrome or Edge.";
		console.error(error);
	}
}

start();
`;
	const formatting = { useTabs: true, tabWidth: 4, printWidth: 100 };
	html = await format(html.replaceAll("</section>", "</section>\n\n").replaceAll("</header>", "</header>\n\n"), {
		...formatting,
		parser: "html",
		htmlWhitespaceSensitivity: "ignore",
	});
	css = await format(css.replaceAll("}\n", "}\n\n"), { ...formatting, parser: "css" });
	js = await format(js.replaceAll("\n/**", "\n\n/**").replaceAll("\nconst ", "\n\nconst "), { ...formatting, parser: "babel" });
	const payload = {
		title: `[CSS] ${effect.name} worklet`,
		description: `${effect.description}\n\nAn interactive CSS Houdini Paint API experiment from Worklet Studio. ${effect.presets.length} presets, live CSS controls, pointer interaction, and reduced-motion support. Uses ${pkg.name}@${pkg.version} from npm via jsDelivr. Open in Chrome or Edge.`,
		html,
		css,
		js,
		layout: "left",
		css_pre_processor: "none",
		js_pre_processor: "none",
	};
	await Promise.all([
		writeFile(
			resolve(directory, "index.html"),
			await format(
				`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(payload.title)}</title><link rel="stylesheet" href="style.css"></head><body>${html}<script type="module" src="script.js"></script></body></html>`,
				{ ...formatting, parser: "html", htmlWhitespaceSensitivity: "ignore" },
			),
		),
		writeFile(resolve(directory, "style.css"), css),
		writeFile(resolve(directory, "script.js"), js),
		writeFile(resolve(directory, "prefill.json"), JSON.stringify(payload, null, "\t")),
	]);
	links.push(
		`<article><h2>${escape(effect.name)}</h2><p>${escape(effect.description)}</p><a href="./${effect.id}/">Preview ${escape(effect.name)}</a><div>${[
			"html",
			"css",
			"js",
		]
			.map(function copyButton(panel) {
				return `<button type="button" data-copy="${effect.id}/${panel}">Copy ${effect.name} ${panel.toUpperCase()}</button>`;
			})
			.join(
				"",
			)}</div><form action="https://codepen.io/pen/define" method="POST"><input type="hidden" name="data" value="${escape(JSON.stringify(payload))}"><button type="submit">Create ${escape(effect.name)} Pen</button></form></article>`,
	);
}
await writeFile(
	resolve(output, "index.html"),
	`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Worklet Studio · CodePen publisher</title><style>body{font:16px system-ui;color:#eee;background-color:#090c12;padding:40px;max-width:1000px;margin:auto}main{display:grid;grid-template-columns:1fr 1fr;gap:20px}article{border:1px solid #343944;padding:24px;border-radius:12px}p{color:#acb5c6;line-height:1.6}a{color:#d2fa86}button{margin-top:20px;padding:12px;font:inherit;cursor:pointer}h1{font-weight:500}</style></head><body><h1>Worklet Studio / CodePens</h1><p>Worklet demos prepared for npm CDN loading. Publish a package before submitting its new Pen. Preview, then submit to CodePen and save to your CSS Houdini collection.</p><main>${links.join("\n")}</main><script>
for (const button of document.querySelectorAll("button[data-copy]")) {
 button.addEventListener("click", async function copy() {
  const [effect, panel] = button.dataset.copy.split("/");
  const payload = await (await fetch("./" + effect + "/prefill.json")).json();
  document.querySelector("#source-view").value = payload[panel];
  await navigator.clipboard.writeText(payload[panel]);
  document.querySelector("#copy-status").textContent = button.textContent + " copied";
 });
}
</script><p id="copy-status" role="status"></p><textarea id="source-view" aria-label="Selected source" rows="20" style="width:100%"></textarea></body></html>`,
);
console.log(`Prepared ${experiments.length} npm-powered Pens in ${output}`);
