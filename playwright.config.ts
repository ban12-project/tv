import { defineConfig, devices } from "@playwright/test";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const accessMode = process.env.ACCESS_MODE === "public" ? "public" : "private";
const port = Number.parseInt(
  process.env.E2E_PORT ?? (accessMode === "public" ? "3101" : "3100"),
  10,
);
const fixturePort = Number.parseInt(
  process.env.E2E_FIXTURE_PORT ?? `${port + 1000}`,
  10,
);
const baseURL = `http://localhost:${port}`;
const fixtureBaseURL = `http://127.0.0.1:${fixturePort}`;
const appEnv = {
  ACCESS_MODE: accessMode,
  BETTER_AUTH_URL: baseURL,
  MAC_CMS_SOURCES: JSON.stringify([
    {
      id: "fixture",
      name: "Fixture CMS",
      type: "json",
      url: `${fixtureBaseURL}/api.php/provide/vod/`,
    },
  ]),
  NEXT_PUBLIC_HOST_URL: baseURL,
  ...(accessMode === "public"
    ? {
        BETTER_AUTH_SECRET: "",
        DATABASE_URL: "",
        NEXT_PUBLIC_AUTH_ENABLED: "",
      }
    : {
        NEXT_PUBLIC_AUTH_ENABLED: "1",
      }),
};

export default defineConfig({
  testDir: "./e2e",
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["html"], ["github"]] : "html",
  webServer: [
    {
      command: `node e2e/fixtures/mac-cms-server.mjs`,
      env: {
        E2E_FIXTURE_PORT: `${fixturePort}`,
      },
      url: fixtureBaseURL,
      reuseExistingServer: false,
    },
    {
      command: `pnpm exec next dev -p ${port}`,
      env: appEnv,
      url: baseURL,
      reuseExistingServer: false,
    },
  ],
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
