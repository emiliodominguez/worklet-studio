import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
await mkdir("artifacts/iteration", { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
page.setDefaultTimeout(15000);
/** Capture the current stage without waiting for an unrelated CSS transition to settle. @param options Screenshot path. */
async function capture(options) {
	const box = await page.locator("#surface").boundingBox();
	if (!box) throw new Error("Missing painted surface");
	await page.screenshot({ ...options, clip: box });
	console.log(options.path);
}
page.on("pageerror", function error(value) {
	console.error(value.message);
});
await page.goto("http://127.0.0.1:4173");
await page.waitForSelector("html[data-ready]");
for (const name of ["Aurora", "Caustics", "Vortex", "Terrain", "Iridescence", "Flow field", "Nebula", "Metaballs", "Kaleidoscope"]) {
	await page.getByRole("button", { name, exact: true }).click();
	await page.locator("#surface").evaluate(function freeze(node) {
		node.style.animation = "none";
		node.style.setProperty("--worklet-time", "0.2");
	});
	await capture({ path: `artifacts/iteration/${name.toLowerCase().replaceAll(" ", "-")}.png` });
}
await page.getByRole("button", { name: "Cursor", exact: true }).click();
for (const name of ["Silk", "Comet", "Original", "Plasma", "Glass", "Atom", "Afterglow", "Ember"]) {
	await page.getByRole("button", { name, exact: true }).click();
	await page.locator("#surface").evaluate(function freeze(node) {
		node.style.animation = "none";
		node.style.setProperty("--worklet-time", "0.2");
	});
	await capture({ path: `artifacts/iteration/cursor-${name.toLowerCase()}.png` });
}
await page.getByRole("button", { name: "Silk", exact: true }).click();
const box = await page.locator("#surface").boundingBox();
for (let step = 0; step < 40; step++) {
	await page.mouse.move(box.x + box.width * (0.2 + step / 65), box.y + box.height * 0.45 + Math.sin(step / 6) * 80);
	await page.evaluate(function frame() {
		return new Promise(requestAnimationFrame);
	});
}
await capture({ path: "artifacts/iteration/cursor-silk-moving.png" });
await page.screenshot({ path: "artifacts/iteration/studio.png", fullPage: true });
for (const [effect, preset, file] of [
	["Particles", "3", "galaxy"],
	["Caustics", "1", "deep-water"],
	["Vortex", "1", "blue-shift"],
	["Terrain", "2", "digital-alps"],
]) {
	await page.getByRole("button", { name: effect, exact: true }).click();
	await page.getByLabel("Preset", { exact: true }).selectOption(preset);
	await page.locator("#surface").evaluate(function freeze(node) {
		node.style.animation = "none";
		node.style.setProperty("--worklet-time", "0.2");
	});
	await capture({ path: `artifacts/iteration/${file}.png` });
}
await browser.close();
