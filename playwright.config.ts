import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["html", { open: "never" }], ["line"]],
  use: {
    baseURL: "http://localhost:3011",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    actionTimeout: 10000,
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        channel: "chrome",
        launchOptions: {
          slowMo: process.env.SLOWMO ? parseInt(process.env.SLOWMO) : 0,
        },
      },
    },
  ],
  // Do NOT start dev server automatically — run `npm run dev` separately
})
