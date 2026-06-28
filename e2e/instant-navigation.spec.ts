import { instant } from "@next/playwright";
import { expect, test } from "@playwright/test";

const accessMode = process.env.ACCESS_MODE === "public" ? "public" : "private";
const isPublic = accessMode === "public";

test("auth pages navigate instantly", async ({ page }) => {
  test.skip(isPublic, "auth pages require private Better Auth");

  await page.goto("/en/sign-in");
  await expect(page.locator('input[name="email"]')).toBeVisible();

  await instant(page, async () => {
    await page.locator('a[href="/en/sign-up"]').click();
    await expect(page.locator('input[name="email"]')).toBeVisible();
  });
});

test("home route matches access mode instantly", async ({ baseURL, page }) => {
  await instant(
    page,
    async () => {
      await page.goto("/en");

      if (isPublic) {
        await expect(page).toHaveURL(/\/en$/);
        await expect(page.locator('input[name="query"]')).toBeVisible();
        return;
      }

      await expect(page).toHaveURL(/\/en\/sign-in\?callbackUrl=/);
      await expect(page.locator('input[name="email"]')).toBeVisible();
    },
    { baseURL },
  );
});

test("public watch route navigates instantly when configured", async ({
  baseURL,
  page,
}) => {
  test.skip(!isPublic, "watch content is behind auth in private mode");

  await instant(
    page,
    async () => {
      await page.goto("/en/watch/fixture/1001/1");
      await expect(page.locator("main")).toBeVisible();
    },
    { baseURL },
  );
});
