import { test, expect } from "@playwright/test";

const names = [
	"Aurora",
	"Particles",
	"Cursor",
	"Flow field",
	"Ripples",
	"Iridescence",
	"Caustics",
	"Vortex",
	"Terrain",
	"Nebula",
	"Metaballs",
	"Kaleidoscope",
];

test("immersive pointer lighting eases, recenters, and cleans up across effects", async function viewInteraction({ page }) {
	await page.goto("/#effect=metaballs");
	await expect(page.locator("html")).toHaveAttribute("data-ready", "true");
	const surface = page.locator("#surface"),
		box = (await surface.boundingBox())!;
	await surface.evaluate(function freeze(node) {
		node.style.animation = "none";
		node.style.setProperty("--worklet-time", "0.25");
	});
	const before = await surface.screenshot();
	await page.mouse.move(box.x + box.width * 0.85, box.y + box.height * 0.3);
	await expect
		.poll(async function position() {
			return surface.evaluate(function read(node) {
				return Number(node.style.getPropertyValue("--worklet-pointer-x"));
			});
		})
		.toBeCloseTo(0.85, 2);
	expect(before.equals(await surface.screenshot())).toBe(false);
	await page.mouse.move(5, 5);
	await expect
		.poll(async function center() {
			return surface.evaluate(function read(node) {
				return Number(node.style.getPropertyValue("--worklet-pointer-x"));
			});
		})
		.toBe(0.5);
	await page.getByRole("button", { name: "Cursor", exact: true }).click();
	await page.mouse.move(box.x + 220, box.y + 220);
	await page.evaluate(function frame() {
		return new Promise(requestAnimationFrame);
	});
	expect(
		await surface.evaluate(function clean(node) {
			return node.style.getPropertyValue("--worklet-pointer-x");
		}),
	).toBe("");
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.getByRole("button", { name: "Metaballs", exact: true }).click();
	await page.mouse.move(box.x + 120, box.y + 120);
	expect(
		await surface.evaluate(function stable(node) {
			return node.style.getPropertyValue("--worklet-pointer-x");
		}),
	).toBe("");
});

test("all twelve actual paint worklets render, animate, and expose working presets", async function rendering({ page }) {
	const errors: string[] = [];
	page.on("pageerror", function error(value) {
		errors.push(value.message);
	});
	page.on("console", function error(message) {
		if (message.type() === "error") errors.push(message.text());
	});
	await page.goto("/");
	await expect(page.locator("html")).toHaveAttribute("data-ready", "true");
	for (const name of names) {
		await page.getByRole("button", { name, exact: true }).click();
		const surface = page.locator("#surface");
		await surface.evaluate(function freeze(node) {
			node.style.animation = "none";
			node.style.setProperty("--worklet-time", "0.2");
		});
		await expect(surface).toHaveCSS("background-image", /^paint\(/);
		const painted = await surface.screenshot({ path: `artifacts/${name.toLowerCase().replaceAll(" ", "-")}.png` });
		await surface.evaluate(function hide(node) {
			node.dataset.image = node.style.backgroundImage;
			node.style.backgroundImage = "none";
		});
		const blank = await surface.screenshot();
		expect(painted.equals(blank), `${name} must paint visible pixels`).toBe(false);
		await surface.evaluate(function animate(node) {
			node.style.backgroundImage = node.dataset.image!;
			node.style.setProperty("--worklet-time", "0.65");
		});
		const moved = await surface.screenshot();
		expect(moved.equals(painted), `${name} should change with time`).toBe(false);
		await page.getByLabel("Preset", { exact: true }).selectOption("1");
		await expect(page.locator("#css-code")).toContainText("--worklet-hue:");
	}
	expect(errors).toEqual([]);
	await page.getByRole("button", { name: "Aurora", exact: true }).click();
	await page.screenshot({ path: "artifacts/studio-desktop.png", fullPage: true });
});

test("controls, reset, motion, copy, and shared settings work", async function controls({ page, context }) {
	await context.grantPermissions(["clipboard-read", "clipboard-write"]);
	await page.goto("/");
	await expect(page.locator("html")).toHaveAttribute("data-ready", "true");
	await page.getByLabel("Threads", { exact: true }).fill("155");
	await expect(page.locator("#css-code")).toContainText("--aurora-ribbons: 155");
	await page.getByRole("button", { name: "Pause motion" }).click();
	await expect(page.locator("#surface")).toHaveCSS("animation-play-state", "paused");
	await page.getByRole("button", { name: "Copy recipe" }).click();
	const recipe = await page.evaluate(function readClipboard() {
		return navigator.clipboard.readText();
	});
	expect(recipe).toContain("--aurora-ribbons: 155");
	expect(recipe).toContain("aurora-worklet/worklet.js?url");
	await page.getByRole("button", { name: "Copy link" }).click();
	const url = await page.evaluate(function readClipboard() {
		return navigator.clipboard.readText();
	});
	await page.goto(url);
	await expect(page.getByLabel("Threads", { exact: true })).toHaveValue("155");
	await page.getByRole("button", { name: "Reset", exact: true }).click();
	await expect(page.getByLabel("Threads", { exact: true })).toHaveValue("110");
});

test("pointer follows local coordinates and stops writing after changing effect", async function pointer({ page }) {
	await page.goto("/");
	await expect(page.locator("html")).toHaveAttribute("data-ready", "true");
	await page.getByRole("button", { name: "Cursor", exact: true }).click();
	const surface = page.locator("#surface"),
		box = (await surface.boundingBox())!;
	await page.mouse.move(box.x + 130, box.y + 170);
	await expect
		.poll(async function xPosition() {
			return surface.evaluate(function x(node) {
				return Number(node.style.getPropertyValue("--cursor-position-x"));
			});
		})
		.toBeCloseTo(130, 0);
	await page.getByRole("button", { name: "Aurora", exact: true }).click();
	await page.mouse.move(box.x + 190, box.y + 220);
	expect(
		await surface.evaluate(function x(node) {
			return node.style.getPropertyValue("--cursor-position-x");
		}),
	).toBe("");
});

test("reduced motion and mobile layout remain usable", async function accessibility({ page }) {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto("/");
	await expect(page.locator("html")).toHaveAttribute("data-ready", "true");
	await expect(page.locator("#surface")).toHaveCSS("animation-name", "none");
	await expect(page.getByRole("button", { name: "Play motion" })).toBeDisabled();
	expect(
		await page.evaluate(function overflow() {
			return document.documentElement.scrollWidth <= innerWidth;
		}),
	).toBe(true);
	await page.screenshot({ path: "artifacts/studio-mobile.png", fullPage: true });
	await page.getByRole("button", { name: "Cursor", exact: true }).click();
	await expect(page.getByRole("group", { name: "Cursor materials" })).toBeVisible();
	await page.getByRole("button", { name: "Plasma", exact: true }).click();
	await expect(page.getByLabel("Preset", { exact: true })).toHaveValue("3");
	expect(
		await page.evaluate(function overflow() {
			return document.documentElement.scrollWidth <= innerWidth;
		}),
	).toBe(true);
	await page.screenshot({ path: "artifacts/studio-cursor-mobile.png", fullPage: true });
});

test("unsupported browsers get an explicit, usable fallback", async function fallback({ page }) {
	await page.addInitScript(function unsupported() {
		Object.defineProperty(CSS, "paintWorklet", { value: undefined });
	});
	await page.goto("/");
	await expect(page.locator("#fallback")).toBeVisible();
	await expect(page.locator("#status")).toHaveText("CSS Paint unavailable");
	await page.getByRole("button", { name: "Particles", exact: true }).click();
	await expect(page.locator("#css-code")).toContainText("paint(particles)");
});

test("worklet network failures show a retry action", async function networkFailure({ page, context }) {
	await context.route(/worklet(?:-[a-zA-Z0-9_-]+)?\.js/, async function fail(route) {
		if (new URL(route.request().url()).searchParams.has("url")) await route.continue();
		else await route.abort();
	});
	await page.goto("/");
	await expect(page.locator("#fallback")).toBeVisible();
	await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
});

test("original cursor ripples animate without pointer movement", async function originalCursor({ page }) {
	await page.goto("/");
	await expect(page.locator("html")).toHaveAttribute("data-ready", "true");
	await page.getByRole("button", { name: "Cursor", exact: true }).click();
	await page.getByLabel("Preset", { exact: true }).selectOption("2");
	const surface = page.locator("#surface");
	await surface.evaluate(function first(node) {
		node.style.animation = "none";
		node.style.setProperty("--worklet-time", "0.1");
	});
	const before = await surface.screenshot();
	await surface.evaluate(function later(node) {
		node.style.setProperty("--worklet-time", "0.8");
	});
	expect(before.equals(await surface.screenshot())).toBe(false);
	await page.getByRole("button", { name: "Pause motion" }).click();
	await expect(surface).toHaveCSS("animation-play-state", "paused");
});

test("all cursor materials paint distinctly and the preset shelf stays in sync", async function cursorMaterials({ page }) {
	await page.goto("/#effect=cursor");
	await expect(page.locator("html")).toHaveAttribute("data-ready", "true");
	const errors: string[] = [];
	page.on("pageerror", function error(value) {
		errors.push(value.message);
	});
	const surface = page.locator("#surface"),
		images: Buffer[] = [];
	for (const name of ["Silk", "Comet", "Original", "Plasma", "Glass", "Atom"]) {
		await page.getByRole("button", { name, exact: true }).click();
		await expect(page.getByRole("button", { name, exact: true })).toHaveAttribute("aria-pressed", "true");
		await expect(page.getByRole("button", { name, exact: true })).toBeFocused();
		await surface.evaluate(function freeze(node) {
			node.style.animation = "none";
			node.style.setProperty("--worklet-time", "0.25");
		});
		const shot = await surface.screenshot();
		for (const previous of images) expect(previous.equals(shot), `${name} must have its own silhouette`).toBe(false);
		images.push(shot);
	}
	expect(errors).toEqual([]);
});

test("cursor history is bounded, press releases outside, and cleanup removes all writes", async function cursorInteraction({ page }) {
	await page.goto("/#effect=cursor");
	await expect(page.locator("html")).toHaveAttribute("data-ready", "true");
	const surface = page.locator("#surface"),
		box = (await surface.boundingBox())!;
	for (let step = 0; step < 12; step++) {
		await page.mouse.move(box.x + 160 + step * 25, box.y + 200 + Math.sin(step) * 35);
		await page.evaluate(function frame() {
			return new Promise(requestAnimationFrame);
		});
	}
	const points = await surface.evaluate(function trail(node) {
		return node.style.getPropertyValue("--cursor-trail").trim().split(/\s+/).map(Number);
	});
	expect(points.length).toBeGreaterThan(4);
	expect(points.length).toBeLessThanOrEqual(64);
	expect(points.every(Number.isFinite)).toBe(true);
	await page.mouse.down();
	await expect
		.poll(async function press() {
			return surface.evaluate(function pressure(node) {
				return Number(node.style.getPropertyValue("--cursor-press"));
			});
		})
		.toBeGreaterThan(0.8);
	await page.mouse.move(10, 10);
	await page.mouse.up();
	await expect
		.poll(async function release() {
			return surface.evaluate(function pressure(node) {
				return Number(node.style.getPropertyValue("--cursor-press"));
			});
		})
		.toBe(0);
	await page.getByRole("button", { name: "Aurora", exact: true }).click();
	expect(
		await surface.evaluate(function clean(node) {
			return [...node.style].filter(function property(name) {
				return name.startsWith("--cursor-");
			});
		}),
	).toEqual([]);
});

test("reduced-motion cursors follow directly without a decorative trail", async function reducedCursor({ page }) {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto("/#effect=cursor");
	await expect(page.locator("html")).toHaveAttribute("data-ready", "true");
	const surface = page.locator("#surface"),
		box = (await surface.boundingBox())!;
	await page.mouse.move(box.x + 150, box.y + 200);
	await page.mouse.move(box.x + 270, box.y + 240);
	await expect
		.poll(async function current() {
			return surface.evaluate(function x(node) {
				return Number(node.style.getPropertyValue("--cursor-position-x"));
			});
		})
		.toBeCloseTo(270, 0);
	expect(
		await surface.evaluate(function history(node) {
			return node.style.getPropertyValue("--cursor-trail").trim().split(/\s+/).length;
		}),
	).toBe(2);
	await expect(surface).toHaveCSS("animation-name", "none");
});
