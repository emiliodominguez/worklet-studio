import { defineConfig } from "vite";
export default defineConfig({
	base: "./",
	build: { assetsInlineLimit: 0, rollupOptions: { input: { studio: "index.html", atrium: "atrium.html" } } },
	server: { strictPort: true },
});
