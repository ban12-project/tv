import { expect, test } from "@playwright/test";

const accessMode = process.env.ACCESS_MODE === "public" ? "public" : "private";
const isPublic = accessMode === "public";

test.describe("public content", () => {
  test.skip(!isPublic, "public content routes require ACCESS_MODE=public");

  test("searches fixture content and syncs the query URL", async ({ page }) => {
    await page.goto("/en");

    const search = page.locator('input[name="query"]:not([readonly])');
    await expect(search).toBeFocused({ timeout: 10000 });
    await search.fill("bullet");

    await expect(page).toHaveURL(/\/en\?q=bullet$/);
    await expect(page.getByRole("link", { name: /Bullet Train/ })).toBeVisible();
  });

  test("renders initial results from the query string", async ({ page }) => {
    await page.goto("/en?q=bullet");

    await expect(page.locator('input[name="query"]:not([readonly])')).toHaveValue(
      "bullet",
    );
    await expect(page.getByRole("link", { name: /Bullet Train/ })).toBeVisible();
  });

  test("opens a watch page from search results", async ({ page }) => {
    await page.goto("/en?q=bullet");

    await page.getByRole("link", { name: /Bullet Train/ }).click();

    await expect(page).toHaveURL(/\/en\/watch\/fixture\/1001\/1$/);
    await expect(
      page.getByRole("heading", { name: "Bullet Train" }),
    ).toBeVisible();
    await expect(page.getByRole("tab", { name: "Frequency List" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Fixture CMS/ })).toBeVisible();
  });
});
