import styles from "./studio.module.scss";
import { icon, brandMark } from "./icons.ts";
import { experiments } from "./catalog.ts";
import type { Control } from "./catalog.ts";
import { attachPointer } from "cursor-worklet/register";
import auroraUrl from "aurora-worklet/worklet.js?url";
import particlesUrl from "particles-worklet/worklet.js?url";
import cursorUrl from "cursor-worklet/worklet.js?url";
import flowUrl from "flow-field-worklet/worklet.js?url";
import rippleUrl from "ripple-worklet/worklet.js?url";
import iridescenceUrl from "iridescence-worklet/worklet.js?url";

import causticsUrl from "caustics-worklet/worklet.js?url";
import vortexUrl from "vortex-worklet/worklet.js?url";
import terrainUrl from "terrain-worklet/worklet.js?url";

const urls = [auroraUrl, particlesUrl, cursorUrl, flowUrl, rippleUrl, iridescenceUrl, causticsUrl, vortexUrl, terrainUrl];
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
let selected = 0,
	preset = 0,
	paused = reducedMotion.matches,
	duration = 24,
	ready = false;
let values: Record<string, string | number> = {};
let detachPointer: (() => void) | undefined;
let pointerFrame = 0;
let surfaceVisible = true;

/** Resolve a required interface element. @param selector Element selector. @returns The matching element. */
function element<T extends HTMLElement = HTMLElement>(selector: string): T {
	const result = document.querySelector<T>(selector);
	if (!result) throw new Error(`Missing interface element: ${selector}`);
	return result;
}

element("#app").innerHTML = `
	<header class="${styles["header"]}">
		<a class="${styles["brand"]}" href="./" aria-label="Worklet Studio home"><span class="${styles["brand-mark"]}" aria-hidden="true">${brandMark()}</span> Worklet Studio</a>
		<a href="#about" class="${styles["about-link"]}">A little CSS magic ${icon("arrow")}</a>
	</header>
	<main class="${styles["main"]}">
		<section class="${styles["intro"]}" aria-labelledby="headline">
			<h1 id="headline">Make CSS a little unreal.</h1>
			<p>Light. Motion. A few custom properties.<br>Nine experiments at the edge of what a background can be.</p>
		</section>
		<nav class="${styles["experiments"]}" aria-label="Choose an experiment">${experiments
			.map(function tab(item, index) {
				return `<button type="button" data-effect="${index}" aria-pressed="${index === 0}">${icon(item.id)}${item.name}</button>`;
			})
			.join("")}</nav>
		<div class="${styles["cursor-shelf"]}" id="cursor-shelf" role="group" aria-label="Cursor materials" hidden></div>
		<div class="${styles["studio"]}">
			<section class="${styles["stage"]}" id="stage" aria-label="Live effect preview">
				<div class="${styles["surface"]}" id="surface" role="img" aria-label="Aurora: luminous folded ribbons"></div>
				<div class="${styles["stage-top"]}"><span id="paint-label">paint(aurora)</span><span id="status" role="status">Loading worklets…</span></div>
				<div class="${styles["stage-title"]}"><span id="stage-name">Aurora</span><p id="stage-subtitle">Light, folded.</p></div>
				<div class="${styles["fallback"]}" id="fallback" hidden><h2>A browser with a little more magic.</h2><p>These experiments use CSS Paint. Open this page in Chrome or Edge over HTTPS or localhost to see them live.</p><button type="button" id="retry">Try again</button></div>
				<div class="${styles["stage-bottom"]}"><button type="button" id="pause" aria-pressed="false">${icon("pause")}<span>Pause motion</span></button><span id="hint">Try a different fold count</span><button type="button" id="fullscreen" aria-label="Enter full screen">${icon("fullscreen")}</button></div>
			</section>
			<aside class="${styles["inspector"]}" aria-label="Effect controls">
				<div class="${styles["inspector-heading"]}"><h2 id="effect-name">Aurora</h2><button type="button" id="reset">${icon("reset")}Reset</button></div>
				<p id="description" class="${styles["description"]}"></p>
				<label class="${styles["preset-label"]}" for="preset">Start somewhere</label><select id="preset" aria-label="Preset"></select>
				<div class="${styles["controls"]}" id="controls"></div>
				<div class="${styles["inspector-actions"]}"><button type="button" id="shuffle">${icon("shuffle")}New variation</button><button type="button" id="share">${icon("link")}Copy link</button></div>
			</aside>
		</div>
		<section class="${styles["recipe"]}" aria-labelledby="recipe-heading">
			<div class="${styles["recipe-intro"]}"><span class="${styles["code-symbol"]}" aria-hidden="true">${icon("code")}</span><div><h2 id="recipe-heading">Take the effect with you.</h2><p>One element. Your colors. Your motion.</p></div><button type="button" id="copy">${icon("copy")}Copy recipe</button></div>
			<details><summary>See the CSS and setup</summary><div class="${styles["recipe-code"]}"><pre><code id="css-code"></code></pre><pre><code id="js-code"></code></pre></div></details>
		</section>
		<section id="about" class="${styles["about"]}"><h2>Yes, this is a CSS background.</h2><p>Each experiment is a Houdini paint worklet: a small JavaScript painter that gives CSS a new kind of image. The animation is driven by a CSS custom property. No canvas elements, videos, or image sequences.</p><p>Made by Emilio Domínguez. Nine independent packages, one shared studio. Chrome and Edge support CSS Paint; other browsers keep a static fallback. Motion pauses when the preview is out of view and respects your reduced-motion preference.</p></section>
	</main>
	<footer class="${styles["footer"]}"><span>Worklet Studio</span><span>Small packages. Unreasonable possibilities.</span></footer>
	<p id="announcement" class="${styles["sr-only"]}" role="status" aria-live="polite"></p>
`;

const surface = element("#surface");
const stage = element("#stage");
const pauseButton = element<HTMLButtonElement>("#pause");
const globalControls: Control[] = [
	{ property: "--worklet-hue", label: "Hue", min: 0, max: 360, step: 1, value: 220 },
	{ property: "--worklet-intensity", label: "Light", min: 0.2, max: 2, step: 0.05, value: 1 },
	{ property: "duration", label: "Loop duration", min: 4, max: 60, step: 1, value: 24 },
];

/** Apply pause, visibility, and reduced-motion state. */
function updateMotion(): void {
	surface.style.animationPlayState = paused || document.hidden || !surfaceVisible ? "paused" : "running";
	pauseButton.innerHTML = `${icon(paused ? "play" : "pause")}<span>${paused ? "Play motion" : "Pause motion"}</span>`;
	pauseButton.setAttribute("aria-pressed", String(paused));
	pauseButton.disabled = reducedMotion.matches || !ready;
	pauseButton.title = reducedMotion.matches ? "Motion is paused by your system preference" : "";
}

/** Build a CSS recipe from the exact visible controls. @returns Copyable CSS. */
function cssRecipe(): string {
	const effect = experiments[selected];
	const properties = Object.entries(values)
		.map(function declaration([name, value]) {
			return `\t${name}: ${value};`;
		})
		.join("\n");
	return `@property --worklet-time {\n\tsyntax: "<number>";\n\tinherits: false;\n\tinitial-value: 0;\n}\n\n.art {\n\tmin-height: 24rem;\n\tbackground-color: #090b12;\n\tbackground-image: linear-gradient(135deg, #182243, #33213d);\n${properties}\n}\n\n@supports (background-image: paint(${effect.id})) {\n\t.art {\n\t\tbackground-image: paint(${effect.id});\n\t\tanimation: worklet-loop ${duration}s linear infinite;\n\t}\n}\n\n@keyframes worklet-loop {\n\tfrom { --worklet-time: 0; }\n\tto { --worklet-time: 1; }\n}\n\n@media (prefers-reduced-motion: reduce) {\n\t.art { animation: none; }\n}`;
}

/** Build a Vite-compatible module setup snippet. @returns Copyable JavaScript. */
function jsRecipe(): string {
	const effect = experiments[selected];
	const pointer = effect.id === "cursor";
	return `// Vite: import the worklet as a hosted asset.\nimport { register${pointer ? ", attachPointer" : ""} } from "${effect.id}-worklet/register";\nimport workletUrl from "${effect.id}-worklet/worklet.js?url";\n\nawait register(workletUrl);${pointer ? '\nconst cleanup = attachPointer(document.querySelector(".art"), { smoothing: 0.24, trail: 32 });\n// Call cleanup() when the element is removed.' : ""}\n\n// HTML: <div class="art"></div>`;
}

/** Update recipe text without recreating focused controls. */
function updateRecipe(): void {
	element("#css-code").textContent = cssRecipe();
	element("#js-code").textContent = jsRecipe();
}

/** Apply all current effect inputs. */
function applyValues(): void {
	for (const [name, value] of Object.entries(values)) surface.style.setProperty(name, String(value));
	surface.style.animationDuration = `${duration}s`;
	updateRecipe();
}

/** Render a labeled range input. @param control Control metadata. @returns Control markup. */
function controlMarkup(control: Control): string {
	const value = control.property === "duration" ? duration : (values[control.property] ?? control.value);
	return `<div class="${styles["control"]}"><label for="${control.property}">${control.label}</label><output for="${control.property}" id="output-${control.property}">${value}${control.property === "duration" ? "s" : ""}</output><input type="range" id="${control.property}" data-property="${control.property}" min="${control.min}" max="${control.max}" step="${control.step}" value="${value}" ${control.property === "--worklet-hue" ? `class="${styles["hue"]}"` : ""}></div>`;
}

/** Render controls after switching an effect or preset. */
function renderControls(): void {
	element("#controls").innerHTML = [...experiments[selected].controls, ...globalControls].map(controlMarkup).join("");
}

/** Reset all inputs to a complete preset, avoiding values leaking between presets. */
function resetValues(): void {
	const effect = experiments[selected];
	values = { "--worklet-seed": 42, "--worklet-hue": 220, "--worklet-intensity": 1 };
	for (const control of effect.controls) values[control.property] = control.value;
	Object.assign(values, effect.presets[preset].values);
	duration = effect.id === "cursor" ? 8 : 24;
}

/** Render the chosen experiment. */
function renderEffect(): void {
	const effect = experiments[selected];
	detachPointer?.();
	if (pointerFrame) cancelAnimationFrame(pointerFrame);
	pointerFrame = 0;
	surface.removeAttribute("style");
	if (ready) surface.style.backgroundImage = `paint(${effect.id})`;
	surface.setAttribute("aria-label", `${effect.name}: ${effect.subtitle}`);
	surface.dataset.effect = effect.id;
	element("#effect-name").textContent = effect.name;
	element("#stage-name").textContent = effect.name;
	element("#stage-subtitle").textContent = effect.subtitle;
	element("#description").textContent = effect.description;
	element("#hint").textContent = effect.hint;
	element("#paint-label").textContent = `paint(${effect.id})`;
	for (const button of document.querySelectorAll<HTMLButtonElement>("[data-effect]"))
		button.setAttribute("aria-pressed", String(Number(button.dataset.effect) === selected));
	element<HTMLSelectElement>("#preset").innerHTML = effect.presets
		.map(function option(item, index) {
			return `<option value="${index}" ${index === preset ? "selected" : ""}>${item.name}</option>`;
		})
		.join("");
	const shelf = element("#cursor-shelf");
	shelf.hidden = effect.id !== "cursor";
	shelf.innerHTML =
		effect.id === "cursor"
			? effect.presets
					.map(function material(item, index) {
						return `<button type="button" data-cursor-preset="${index}" aria-pressed="${index === preset}">${icon(String(item.values["--cursor-mode"]))}<span>${item.name}</span></button>`;
					})
					.join("")
			: "";
	renderControls();
	applyValues();
	updateMotion();
	if (effect.id === "cursor" && ready) detachPointer = attachPointer(surface, { touch: true, smoothing: 0.24, trail: 32 });
}

/** Copy text and announce success or a useful failure. @param text Text to copy. @param message Success message. */
async function copy(text: string, message: string): Promise<void> {
	try {
		await navigator.clipboard.writeText(text);
		announce(message);
	} catch {
		announce("Clipboard unavailable. Open the recipe below and copy its text.");
		element<HTMLDetailsElement>("details").open = true;
	}
}

/** Announce feedback visibly and to assistive technology. @param message Feedback text. */
function announce(message: string): void {
	element("#announcement").textContent = message;
	element("#status").textContent = message;
}

/** Read a shared effect, accepting only known, bounded numeric inputs. */
function readHash(): void {
	const params = new URLSearchParams(location.hash.slice(1));
	const index = experiments.findIndex(function match(effect) {
		return effect.id === params.get("effect");
	});
	selected = index >= 0 ? index : 0;
	preset = Math.max(0, Math.min(experiments[selected].presets.length - 1, Number.parseInt(params.get("preset") || "0") || 0));
	resetValues();
	for (const control of [...experiments[selected].controls, ...globalControls]) {
		const raw = params.get(control.property);
		if (raw === null) continue;
		const value = Number(raw);
		if (!Number.isFinite(value)) continue;
		const bounded = Math.max(control.min, Math.min(control.max, value));
		if (control.property === "duration") duration = bounded;
		else values[control.property] = bounded;
	}
	const seed = Number(params.get("seed"));
	if (params.has("seed") && Number.isFinite(seed)) values["--worklet-seed"] = Math.max(0, Math.min(1e6, seed));
}

for (const button of document.querySelectorAll<HTMLButtonElement>("[data-effect]")) {
	button.addEventListener("click", function selectEffect() {
		selected = Number(button.dataset.effect);
		preset = 0;
		resetValues();
		renderEffect();
	});
}
element("#cursor-shelf").addEventListener("click", function chooseMaterial(event) {
	const button = (event.target as Element).closest<HTMLButtonElement>("[data-cursor-preset]");
	if (!button) return;
	preset = Number(button.dataset.cursorPreset);
	resetValues();
	renderEffect();
	element<HTMLButtonElement>(`[data-cursor-preset="${preset}"]`).focus({ preventScroll: true });
});
element("#preset").addEventListener("change", function selectPreset(event) {
	preset = Number((event.target as HTMLSelectElement).value);
	resetValues();
	renderEffect();
});
element("#reset").addEventListener("click", function reset() {
	resetValues();
	renderEffect();
});
element("#controls").addEventListener("input", function adjust(event) {
	const input = event.target as HTMLInputElement,
		property = input.dataset.property;
	if (!property) return;
	if (property === "duration") duration = Number(input.value);
	else values[property] = Number(input.value);
	element(`#output-${property}`).textContent = input.value + (property === "duration" ? "s" : "");
	applyValues();
});
element("#shuffle").addEventListener("click", function shuffle() {
	values["--worklet-seed"] = Math.floor(Math.random() * 100000);
	values["--worklet-hue"] = Math.floor(Math.random() * 360);
	applyValues();
	renderControls();
	announce("New variation");
});
pauseButton.addEventListener("click", function toggleMotion() {
	paused = !paused;
	updateMotion();
});
element("#copy").addEventListener("click", function copyRecipe() {
	void copy(`/* CSS */\n${cssRecipe()}\n\n/* JavaScript — your app entry */\n${jsRecipe()}`, "Recipe copied");
});
element("#share").addEventListener("click", function share() {
	const params = new URLSearchParams({
		effect: experiments[selected].id,
		preset: String(preset),
		duration: String(duration),
		seed: String(values["--worklet-seed"]),
	});
	for (const control of [...experiments[selected].controls, ...globalControls])
		if (control.property !== "duration") params.set(control.property, String(values[control.property]));
	const url = new URL(location.href);
	url.hash = params.toString();
	void copy(url.href, "Link copied");
});
element("#fullscreen").addEventListener("click", async function fullscreen() {
	try {
		if (document.fullscreenElement) await document.exitFullscreen();
		else await stage.requestFullscreen();
	} catch {
		announce("Full screen is unavailable in this browser");
	}
});
document.addEventListener("fullscreenchange", function fullscreenChanged() {
	element("#fullscreen").setAttribute("aria-label", document.fullscreenElement ? "Exit full screen" : "Enter full screen");
	element("#fullscreen").innerHTML = icon(document.fullscreenElement ? "collapse" : "fullscreen");
});
reducedMotion.addEventListener("change", function motionChanged() {
	paused = reducedMotion.matches;
	updateMotion();
});
document.addEventListener("visibilitychange", updateMotion);
new IntersectionObserver(function visibility(entries) {
	surfaceVisible = entries[0].isIntersecting;
	updateMotion();
}).observe(surface);
window.addEventListener("hashchange", function sharedEffect() {
	if (!location.hash.includes("effect=")) return;
	readHash();
	renderEffect();
});
surface.addEventListener(
	"pointermove",
	function pointer(event) {
		if (!ready || !["ripple", "iridescence"].includes(experiments[selected].id)) return;
		if (pointerFrame) cancelAnimationFrame(pointerFrame);
		pointerFrame = requestAnimationFrame(function paintPointer() {
			pointerFrame = 0;
			const rect = surface.getBoundingClientRect();
			if (!rect.width || !rect.height) return;
			const id = experiments[selected].id;
			const x = (event.clientX - rect.left) / rect.width,
				y = (event.clientY - rect.top) / rect.height;
			surface.style.setProperty(`--${id}-position-x`, String(id === "ripple" ? x * surface.offsetWidth : x));
			surface.style.setProperty(`--${id}-position-y`, String(id === "ripple" ? y * surface.offsetHeight : y));
		});
	},
	{ passive: true },
);

/** Load each actual CSS Paint module and surface actionable errors. */
async function start(): Promise<void> {
	const css = CSS as typeof CSS & { paintWorklet?: { addModule(url: string): Promise<void> } };
	if (!css.paintWorklet) {
		element("#fallback").hidden = false;
		announce("CSS Paint unavailable");
		updateMotion();
		return;
	}
	try {
		await Promise.all(
			urls.map(function load(url) {
				return css.paintWorklet!.addModule(url);
			}),
		);
		ready = true;
		element("#fallback").hidden = true;
		element("#status").textContent = "Live CSS paint";
		document.documentElement.dataset.ready = "true";
		renderEffect();
	} catch {
		element("#fallback").hidden = false;
		element("#fallback p").textContent = "A worklet could not load. Check your connection and try again.";
		announce("Worklet failed to load");
	}
}
element("#retry").addEventListener("click", function retry() {
	location.reload();
});
readHash();
renderEffect();
void start();
