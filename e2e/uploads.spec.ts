import { expect, test } from "@playwright/test";
import { hasCredentials, loginAs } from "./fixtures";

test.describe("upload validation and storage entry points", () => {
  test("candidate profile exposes constrained photo and resume upload controls", async ({ page }) => {
    test.skip(!hasCredentials("candidate"), "Set E2E_CANDIDATE_EMAIL and E2E_CANDIDATE_PASSWORD.");
    await loginAs(page, "candidate", "/settings/profile");
    await page.goto("/settings/profile");

    const photo = page.locator('input[type="file"][accept="image/jpeg,image/png,image/webp"]');
    const resume = page.locator('input[type="file"][accept="application/pdf,.pdf"]');
    await expect(photo).toHaveCount(1);
    await expect(resume).toHaveCount(1);
  });

  test("candidate profile rejects a non-PDF resume before storage upload", async ({ page }) => {
    test.skip(!hasCredentials("candidate"), "Set E2E_CANDIDATE_EMAIL and E2E_CANDIDATE_PASSWORD.");
    await loginAs(page, "candidate", "/settings/profile");
    await page.goto("/settings/profile");

    await page.locator('input[type="file"][accept="application/pdf,.pdf"]').setInputFiles({
      name: "resume.exe",
      mimeType: "application/octet-stream",
      buffer: Buffer.from("MZ synthetic e2e payload"),
    });
    await expect(page.getByText(/Resume must be a PDF smaller than 5MB/i)).toBeVisible();
  });
});
