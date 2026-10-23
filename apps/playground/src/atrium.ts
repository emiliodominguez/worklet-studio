import styles from "./atrium.module.scss";
import { icon, brandMark } from "./icons.ts";
import { register, attachArchitecture } from "architecture-worklet/register";
import workletUrl from "architecture-worklet/worklet.js?url";

/** Resolve an experience control. @param selector DOM selector. @returns Required element. */
function element<T extends HTMLElement = HTMLElement>(selector: string): T {
	const found = document.querySelector<T>(selector);
	if (!found) throw new Error(`Missing atrium control: ${selector}`);
	return found;
}

element("#app").innerHTML = `
	<main class="${styles["experience"]}">
		<div class="${styles["world"]}" id="world" tabindex="0" role="region" aria-label="Interactive concrete atrium. Move to look, scroll or use up and down arrow keys to explore. Hold the pointer or space to separate the building."></div>
		<header class="${styles["header"]}">
			<a class="${styles["brand"]}" href="./" aria-label="Worklet Studio">${brandMark()}<span>Worklet Studio</span></a>
			<div class="${styles["header-actions"]}">
				<button type="button" id="tour" aria-pressed="false">${icon("play")}<span>Take a tour</span></button>
				<button type="button" id="source" aria-label="See the CSS">${icon("code")}<span>See the CSS</span></button>
				<button type="button" id="fullscreen" aria-label="Enter full screen">${icon("fullscreen")}</button>
			</div>
		</header>
		<p class="${styles["status"]}" id="status" role="status">Opening the atrium…</p>
		<footer class="${styles["footer"]}">
			<div class="${styles["title"]}"><p>An architecture worklet by Emilio Domínguez</p><h1>Atrium</h1><p class="${styles["instructions"]}">Move to look. Scroll to enter. Hold to pull it apart.</p></div>
			<section class="${styles["controls"]}" aria-label="Atrium controls">
				<div class="${styles["lighting"]}" role="group" aria-label="Time of day">
					<button type="button" data-day="1" aria-pressed="false">Daylight</button>
					<button type="button" data-day="0.72" aria-pressed="true">Late afternoon</button>
					<button type="button" data-day="0.04" aria-pressed="false">After hours</button>
				</div>
				<div class="${styles["journey"]}"><label for="travel">Explore the building</label><input id="travel" type="range" min="0" max="1" step="0.001" value="0" aria-label="Camera position" /></div>
				<div class="${styles["actions"]}"><button type="button" id="separate" aria-pressed="false">${icon("architecture")}<span>Separate floors</span></button><button type="button" id="pause" aria-pressed="false">${icon("pause")}<span>Pause</span></button></div>
			</section>
		</footer>
		<dialog class="${styles["source"]}" id="source-dialog" aria-labelledby="source-title">
			<div class="${styles["dialog-heading"]}"><h2 id="source-title">This is a background.</h2><button type="button" id="close-source" aria-label="Close CSS">${icon("close")}</button></div>
			<p>The building, light and reflections are painted by <code>architecture-worklet</code>. This page supplies one element and its controls.</p>
			<pre><code>.atrium {
	min-height: 100svh;
	background-image: paint(architecture);

	--architecture-travel: 0;
	--architecture-daylight: 0.72;
	--architecture-explode: 0;
}</code></pre>
			<pre><code>import { register, attachArchitecture }
	from "architecture-worklet/register";

import workletUrl
	from "architecture-worklet/worklet.js?url";

await register(workletUrl);

const cleanup = attachArchitecture(
	document.querySelector(".atrium"),
	{ wheel: true }
);</code></pre>
			<a href="./#effect=architecture">Open the studio ${icon("arrow")}</a>
			<p><a href="https://github.com/emiliodominguez/worklet-studio/tree/main/packages/architecture-worklet">Source on GitHub ${icon("arrow")}</a></p>
		</dialog>
	</main>
`;

const world = element("#world");
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
let paused = reduced.matches;
let separated = false;
let cleanup: (() => void) | undefined;
world.style.setProperty("--architecture-daylight", "0.72");

/** Honor user pause, document visibility and reduced motion. */
function motion(): void {
	world.style.animationPlayState = paused || document.hidden || reduced.matches ? "paused" : "running";
	const button = element<HTMLButtonElement>("#pause");
	button.setAttribute("aria-pressed", String(paused || reduced.matches));
	button.innerHTML = `${icon(paused || reduced.matches ? "play" : "pause")}<span>${paused || reduced.matches ? "Play" : "Pause"}</span>`;
	button.disabled = reduced.matches;
	element<HTMLButtonElement>("#tour").disabled = reduced.matches;
	if (reduced.matches) stopTour();
}

/** Stop the camera tour at its current location before manual navigation. */
function stopTour(): void {
	if (world.dataset.tour !== "true") return;
	const position = getComputedStyle(world).getPropertyValue("--architecture-travel");
	delete world.dataset.tour;
	world.style.setProperty("--architecture-travel", position);
	element("#tour").setAttribute("aria-pressed", "false");
	element("#tour span").textContent = "Take a tour";
}

element("#tour").addEventListener("click", function tour() {
	if (world.dataset.tour === "true") {
		stopTour();
		return;
	}
	world.style.setProperty("--tour-start", getComputedStyle(world).getPropertyValue("--architecture-travel") || "0");
	world.dataset.tour = "true";
	paused = false;
	motion();
	element("#tour").setAttribute("aria-pressed", "true");
	element("#tour span").textContent = "Stop tour";
});

world.addEventListener("pointerdown", stopTour);
world.addEventListener("wheel", stopTour, { passive: true });
world.addEventListener("keydown", stopTour);

element("#pause").addEventListener("click", function pause() {
	paused = !paused;
	motion();
});
document.addEventListener("visibilitychange", motion);
reduced.addEventListener("change", motion);

for (const button of document.querySelectorAll<HTMLButtonElement>("[data-day]")) {
	button.addEventListener("click", function daylight() {
		world.style.setProperty("--architecture-daylight", button.dataset.day!);
		for (const sibling of document.querySelectorAll("[data-day]")) sibling.setAttribute("aria-pressed", String(sibling === button));
	});
}

element<HTMLInputElement>("#travel").addEventListener("input", function travel(event) {
	stopTour();
	world.style.setProperty("--architecture-travel", (event.target as HTMLInputElement).value);
});

element("#separate").addEventListener("click", function separate() {
	stopTour();
	separated = !separated;
	world.style.setProperty("--architecture-explode", separated ? "1" : "0");
	element("#separate").setAttribute("aria-pressed", String(separated));
	element("#separate span").textContent = separated ? "Reassemble" : "Separate floors";
});

// Keep the accessible controls in sync with wheel and pointer input without a polling loop.
new MutationObserver(function synchronize() {
	element<HTMLInputElement>("#travel").value = world.style.getPropertyValue("--architecture-travel") || "0";
	separated = parseFloat(world.style.getPropertyValue("--architecture-explode")) > 0.5;
	element("#separate").setAttribute("aria-pressed", String(separated));
	element("#separate span").textContent = separated ? "Reassemble" : "Separate floors";
}).observe(world, { attributes: true, attributeFilter: ["style"] });

const dialog = element<HTMLDialogElement>("#source-dialog");
element("#source").addEventListener("click", function source() {
	dialog.showModal();
});
element("#close-source").addEventListener("click", function close() {
	dialog.close();
});
element("#fullscreen").addEventListener("click", async function fullscreen() {
	try {
		if (document.fullscreenElement) await document.exitFullscreen();
		else await document.documentElement.requestFullscreen();
	} catch {
		element("#status").textContent = "Full screen is unavailable in this browser.";
	}
});
document.addEventListener("fullscreenchange", function fullscreenChanged() {
	element("#fullscreen").setAttribute("aria-label", document.fullscreenElement ? "Exit full screen" : "Enter full screen");
	element("#fullscreen").innerHTML = icon(document.fullscreenElement ? "collapse" : "fullscreen");
});

/** Load the npm workspace package and connect its interaction helper. */
async function start(): Promise<void> {
	try {
		if (!(await register(workletUrl))) {
			element("#status").textContent = "Open this scene in Chrome or Edge to explore the CSS paint worklet.";
			return;
		}
		world.dataset.ready = "true";
		document.documentElement.dataset.ready = "true";
		element("#status").textContent = "";
		cleanup = attachArchitecture(world, { wheel: true });
		motion();
	} catch {
		element("#status").textContent = "The architecture worklet could not load. Reload the page to try again.";
	}
}

window.addEventListener("pagehide", function dispose() {
	cleanup?.();
});
window.addEventListener("pageshow", function restore(event) {
	if (event.persisted) cleanup = attachArchitecture(world, { wheel: true });
});
void start();
