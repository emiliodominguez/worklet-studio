import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import { resolve } from "node:path";
import { compileString } from "sass";
import { icon, brandMark } from "../../apps/playground/src/icons.ts";

/** Prepare the full atrium experience with its published npm renderer. @param {string} packageUrl Versioned npm CDN URL. @returns {Promise<{html: string, css: string, js: string}>} Separate Pen sources. */
export async function createAtriumPen(packageUrl) {
	const root = resolve(import.meta.dirname, "../..");
	const source = await readFile(resolve(root, "apps/playground/src/atrium.ts"), "utf8");
	const stylesheet = await readFile(resolve(root, "apps/playground/src/atrium.module.scss"), "utf8");
	const template = source.match(/element\("#app"\)\.innerHTML = `([\s\S]*?)`;/);
	if (!template) throw new Error("The atrium HTML template could not be found.");

	const html = template[1]
		.replace(/\$\{styles\["([^"]+)"\]\}/g, "$1")
		.replaceAll("${brandMark()}", brandMark())
		.replace(/\$\{icon\("([^"]+)"\)\}/g, function renderIcon(match, name) {
			return icon(name);
		})
		.replaceAll('href="./"', 'href="https://emiliodominguez.github.io/worklet-studio/"')
		.replaceAll('href="./#effect=architecture"', 'href="https://emiliodominguez.github.io/worklet-studio/#effect=architecture"');

	const css = compileString(stylesheet.replace(/:global\(([^)]+)\)/g, "$1"), { style: "expanded" }).css;
	const icons = Object.fromEntries(
		["play", "pause", "collapse", "fullscreen"].map(function entry(name) {
			return [name, icon(name)];
		}),
	);
	const controls = source
		.replace(/^import .+;\n/gm, "")
		.replace(template[0], "")
		.replace(
			"/** Load the npm workspace package and connect its interaction helper. */",
			"/** Load the published npm package and connect its interaction helper. */",
		)
		.replace(
			"if (!(await register(workletUrl))) {",
			`const library = await import("${packageUrl}/dist/register.js");
		attachArchitecture = library.attachArchitecture;
		if (!(await library.register(workletUrl))) {`,
		);

	const js = `// The renderer and pointer navigation come from architecture-worklet on npm.
// This file connects the controls to CSS custom properties.

const workletUrl = "${packageUrl}/worklet.js";

let attachArchitecture;

const icons = ${JSON.stringify(icons, null, "\t")};

/** Get an inline SVG for a control. @param {string} name Icon name. @returns {string} SVG markup. */
function icon(name) {
	return icons[name];
}

${stripTypeScriptTypes(controls, { mode: "strip" })}`;

	return { html, css, js };
}
