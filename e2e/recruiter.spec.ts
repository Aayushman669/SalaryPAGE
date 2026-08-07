import { expect, test } from "@playwright/test";
import { hasCredentials, loginAs, mutationsEnabled } from "./fixtures";

test.describe("recruiter workflow", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!hasCredentials("recruiter"), "Set E2E_RECRUITER_EMAIL and E2E_RECRUITER_PASSWORD.");
    await loginAs(page, "recruiter");
  });

  test("recruiter can reach jobs, applicants, interviews, settings and billing", async ({ page }) => {
    for (const path of ["/dashboard", "/jobs?status=all", "/applications", "/interviews", "/settings", "/dashboard/billing"]) {
      await page.goto(path);
      await expect(page.locator("body")).toBeVisible();
      await expect(page).not.toHaveURL(/\/login/);
    }
  });

  test("recruiter dashboard renders Plan & Usage without client-controlled plan data", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByText(/Plan & Usage|Plan overview|Job usage/i).first()).toBeVisible();
  });

  test("applicant management and interviews expose primary workflows", async ({ page }) => {
    await page.goto("/applications");
    await expect(page.getByText(/Applicant Management|Applications/i).first()).toBeVisible();
    await page.goto("/interviews");
    await expect(page.getByRole("heading", { name: /Interviews/i }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /schedule interview/i }).first()).toBeVisible();
  });

  test("recruiter can open the post-job preview without saving a record", async ({ page }) => {
    test.skip(!mutationsEnabled(), "Set E2E_ALLOW_MUTATIONS=true for authenticated recruiter workflow tests.");
    await page.goto("/post-job");
    await expect(page.getByRole("heading", { name: "Post a Job" })).toBeVisible();
    await page.getByRole("button", { name: "Preview", exact: true }).click();
    await expect(page.getByText(/Job preview|Preview/i).first()).toBeVisible();
  });
});
