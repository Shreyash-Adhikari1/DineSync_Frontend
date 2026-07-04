import { expect, test } from "@playwright/test";
import { mockFrontendApi } from "./fixtures/api";

test.beforeEach(async ({ page }) => {
  await mockFrontendApi(page);
});

test("redirects the root page to business login", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveURL(/\/business\/login$/);
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
});

test("logs in a business and opens the dashboard with mocked workspace data", async ({ page }) => {
  await page.goto("/business/login");

  await page.getByLabel("Email").fill("owner@test.local");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/business\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  await expect(page.getByText("Playwright Bistro").first()).toBeVisible();
});

test("registers a business and returns to login", async ({ page }) => {
  await page.goto("/business/register");

  await page.getByLabel("Business name").fill("Playwright Owner");
  await page.getByLabel("Email").fill("owner@test.local");
  await page.getByLabel("Password").fill("password123");
  await page.getByLabel("Phone").fill("9800000000");
  await page.getByLabel("Address").fill("Kathmandu");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL(/\/business\/login$/);
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
});

test("keeps dashboard protected when no business token exists", async ({ page }) => {
  await page.goto("/business/dashboard");

  await expect(page).toHaveURL(/\/business\/login$/);
});
