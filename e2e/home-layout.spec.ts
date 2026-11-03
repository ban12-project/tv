import { expect, test } from "@playwright/test";

declare global {
  interface Window {
    homeLayoutSamples: { width: number; height: number; viewport: number }[];
  }
}

test.describe("home first paint", () => {
  test.skip(process.env.ACCESS_MODE !== "public", "public home required");

  for (const viewport of [
    { width: 1280, height: 720 },
    { width: 1920, height: 1080 },
    { width: 1024, height: 600 },
    { width: 1280, height: 450 },
    { width: 390, height: 844 },
  ]) {
    test(`loading and hydration preserve the viewport at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.addInitScript(() => {
        window.homeLayoutSamples = [];
        let frames = 0;
        const sample = () => {
          if (document.body && document.querySelector("header")) {
            window.homeLayoutSamples.push({
              width: document.documentElement.scrollWidth,
              height: document.documentElement.scrollHeight,
              viewport: document.documentElement.clientWidth,
            });
          }
          if (++frames < 600) requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      });
      // Keep the server-rendered loading UI visible long enough to measure
      // it, rather than checking only the settled client-rendered page.
      await page.route("**/_next/static/**/*.js", async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 600));
        await route.continue();
      });
      await page.goto("/zh");
      await expect(
        page.locator('input[name="query"]:not([readonly]):visible'),
      ).toBeVisible();
      await expect(page.locator("header")).toHaveAttribute(
        "aria-busy",
        "false",
      );
      if (
        process.env.E2E_RUNTIME_SERVICES === "fixture" &&
        viewport.width >= 768
      ) {
        await expect(
          page.getByRole("button", { name: "风云榜 (豆瓣250)" }),
        ).toBeVisible();
      }
      await page.waitForTimeout(300);
      const samples = await page.evaluate(() => window.homeLayoutSamples);
      expect(samples.length).toBeGreaterThan(0);
      expect(
        samples.filter((sample) => sample.height > viewport.height + 1),
      ).toEqual([]);
      expect(samples.filter((sample) => sample.width > viewport.width)).toEqual(
        [],
      );
      expect(new Set(samples.map((sample) => sample.viewport))).toEqual(
        new Set([viewport.width]),
      );
      expect(errors).toEqual([]);
    });
  }
});
