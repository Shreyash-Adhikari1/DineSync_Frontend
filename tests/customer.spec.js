import { expect, test } from "@playwright/test";
import { mockFrontendApi } from "./fixtures/api";

test.beforeEach(async ({ page }) => {
  await mockFrontendApi(page);
});

test("joins a table from a QR route without calling the real backend", async ({ page }) => {
  await page.goto("/join/qr-token-test");

  await expect(page.getByRole("heading", { name: "Settle in. Your table is ready." })).toBeVisible();

  await page.getByLabel("Your name").fill("Asha");
  await page.getByRole("button", { name: "Join table" }).click();

  await expect(page).toHaveURL(/\/session\/session-test-1$/);
  await expect(page.getByRole("heading", { name: "Your privacy is safe with us." })).toBeVisible();

  await page.getByRole("button", { name: "Continue to menu" }).click();
  await expect(page.getByText("Playwright Bistro").first()).toBeVisible();
  await expect(page.getByText("1 guests seated")).toBeVisible();
});
