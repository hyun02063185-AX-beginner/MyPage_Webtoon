import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  use: { baseURL: "http://127.0.0.1:3100", ...devices["Desktop Chrome"] },
  webServer: {
    command: "npm run start -- --port 3100",
    env: {
      ...process.env,
      DATABASE_URL: "file:../data/e2e/app.db",
      AI_GENERATION_ENABLED: "false",
      AI_GENERATION_MODE: "mock",
    },
    url: "http://127.0.0.1:3100",
    reuseExistingServer: false,
  },
});
