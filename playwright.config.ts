import { defineConfig } from "@playwright/test";
export default defineConfig({
	testDir: "tests/browser",
	fullyParallel: false,
	workers: 1,
	timeout: 30000,
	use: {
		baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:4173",
		viewport: { width: 1440, height: 1100 },
		browserName: "chromium",
		headless: true,
	},
	webServer: process.env.PLAYWRIGHT_BASE_URL
		? undefined
		: { command: "npm run dev", url: "http://127.0.0.1:4173", reuseExistingServer: !process.env.CI, timeout: 120000 },
});
