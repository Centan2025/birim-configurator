import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests", testMatch: "**/*.spec.ts", timeout: 60000, workers: 1, retries: 0,
  outputDir: "test-results/v41-playwright",
  reporter: [["list"], ["json", { outputFile: "test-results/v41-playwright-results.json" }]],
  use: { baseURL: "http://localhost:3311", viewport: { width: 1440, height: 900 }, trace: "retain-on-failure", actionTimeout: 15000 },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: { command: "npm exec --workspace=apps/configurator -- next start -p 3311", url: "http://localhost:3311", reuseExistingServer: false, timeout: 60000, env: { BIRIM_AUDIT_BUILD: "1" } },
});
