import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.ts",
  timeout: 30000,
  workers: 1,
  retries: 0,
  use: {
    baseURL: "http://localhost:3300",
    trace: "on-first-retry",
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "ipad-landscape",
      use: { ...devices["iPad Pro 11 landscape"] },
    },
    {
      name: "ipad-portrait",
      use: { ...devices["iPad Pro 11"] },
    },
    {
      name: "iphone-14",
      use: { ...devices["iPhone 14"] },
    },
    {
      name: "pixel-7",
      use: { ...devices["Pixel 7"] },
    },
  ],
  webServer: {
    command: "npm run start",
    url: "http://localhost:3300",
    reuseExistingServer: true,
    timeout: 60000,
  },
});
