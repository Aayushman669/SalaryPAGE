import { expect, test } from "@playwright/test";
import { hasCredentials, loginAs, mutationsEnabled } from "./fixtures";

test.describe("candidate workflow", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!hasCredentials("candidate"), "Set E2E_CANDIDATE_EMAIL and E2E_CANDIDATE_PASSWORD.");
    await loginAs(page, "candidate");
  });

  test("candidate can reach protected workspace sections", async ({ page }) => {
    for (const path of ["/dashboard", "/saved-jobs", "/applications", "/interviews", "/notifications", "/settings"]) {
      await page.goto(path);
      await expect(page.locator("main").or(page.locator("body"))).toBeVisible();
      await expect(page).not.toHaveURL(/\/login/);
    }
  });

  test("candidate dashboard exposes browse and application entry points", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("link", { name: /browse jobs/i }).first()).toBeVisible();
  });

  test("candidate can submit a synthetic application to an explicitly configured staging job", async ({ page }) => {
    const jobSlug = process.env.E2E_PUBLIC_JOB_SLUG;
    test.skip(!mutationsEnabled() || !jobSlug, "Set E2E_ALLOW_MUTATIONS=true and E2E_PUBLIC_JOB_SLUG for isolated application tests.");
    await page.goto(`/jobs/${encodeURIComponent(jobSlug ?? "")}`);

    const existingApplication = page.getByText(/Already Applied|View My Applications/i).first();
    test.skip(await existingApplication.isVisible().catch(() => false), "The configured staging candidate already applied to this job.");

    const resume = page.locator('input[type="file"][accept="application/pdf,.pdf"]');
    await expect(resume).toBeVisible();
    await resume.setInputFiles({
      name: "jobforge-e2e-resume.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF"),
    });
    await page.getByPlaceholder("Optional note for the recruiter").fill("Synthetic Playwright application for staging verification.");
    await page.getByRole("button", { name: "Apply Now", exact: true }).click();
    await expect(page).toHaveURL(/\/applications(?:[/?#]|$)/);
  });
});
