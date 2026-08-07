import { expect, test } from "@playwright/test";
import { hasCredentials, loginAs, logoutFromSidebar } from "./fixtures";

test.describe("authentication validation and session flows", () => {
  test("login rejects malformed email before contacting authentication", async ({ page }) => {
    await page.goto("/login");
    const email = page.getByLabel("Email Address");
    test.skip(!(await email.isVisible({ timeout: 5_000 }).catch(() => false)), "Local Supabase auth is not available; run with configured auth for UI validation.");
    await email.fill("not-an-email");
    await page.getByLabel("Password").fill("not-a-real-password");
    await page.getByRole("button", { name: "Login", exact: true }).click();
    await expect(page.getByText(/valid email/i)).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("signup validates password and terms locally", async ({ page }) => {
    await page.goto("/signup");
    const fullName = page.getByLabel("Full Name");
    test.skip(!(await fullName.isVisible({ timeout: 5_000 }).catch(() => false)), "Local Supabase auth is not available; run with configured auth for UI validation.");
    await fullName.fill("E2E Test User");
    await page.getByLabel("Email Address").fill("e2e-invalid@example.test");
    await page.getByLabel("Password", { exact: true }).fill("weak");
    await page.getByLabel("Confirm Password").fill("weak");
    await page.getByRole("button", { name: "Create Account", exact: true }).click();
    await expect(page.locator("body")).toContainText(/password|terms/i);
    await expect(page).toHaveURL(/\/signup/);
  });

  test("forgot-password page exposes a safe recovery form", async ({ page }) => {
    await page.goto("/forgot-password");
    await expect(page.getByRole("heading", { name: /forgot your password/i })).toBeVisible();
    await expect(page.getByLabel(/email/i).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /reset|send/i }).first()).toBeVisible();
  });

  test("configured candidate can login and logout", async ({ page }) => {
    test.skip(!hasCredentials("candidate"), "Set E2E_CANDIDATE_EMAIL and E2E_CANDIDATE_PASSWORD.");
    await loginAs(page, "candidate");
    await expect(page).toHaveURL(/\/(dashboard|onboarding)(?:[/?#]|$)/);
    await logoutFromSidebar(page);
  });

  test("configured recruiter can login and logout", async ({ page }) => {
    test.skip(!hasCredentials("recruiter"), "Set E2E_RECRUITER_EMAIL and E2E_RECRUITER_PASSWORD.");
    await loginAs(page, "recruiter");
    await expect(page).toHaveURL(/\/(dashboard|onboarding)(?:[/?#]|$)/);
    await logoutFromSidebar(page);
  });
});
