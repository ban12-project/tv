import { defineConfig, devices } from "@playwright/test";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const accessMode = process.env.ACCESS_MODE === "public" ? "public" : "private";
const port = Number.parseInt(
  process.env.E2E_PORT ?? (accessMode === "public" ? "3101" : "3100"),
  10,
);
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: "./e2e",
  webServer: {
    command: `pnpm exec next dev -p ${port}`,
    env: {
      ACCESS_MODE: accessMode,
      BETTER_AUTH_URL: baseURL,
      NEXT_PUBLIC_HOST_URL: baseURL,
    },
    url: baseURL,
    reuseExistingServer: false,
  },
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
