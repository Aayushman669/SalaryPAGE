import { expect, test } from "@playwright/test";
import { hasCredentials, loginAs } from "./fixtures";

test.describe("notifications and email boundaries", () => {
  test("candidate can open the notifications center when configured", async ({ page }) => {
    test.skip(!hasCredentials("candidate"), "Set E2E_CANDIDATE_EMAIL and E2E_CANDIDATE_PASSWORD.");
    await loginAs(page, "candidate", "/notifications");
    await page.goto("/notifications");
    await expect(page.getByRole("heading", { name: /notifications/i }).first()).toBeVisible();
  });

  test("recruiter can open the notifications center when configured", async ({ page }) => {
    test.skip(!hasCredentials("recruiter"), "Set E2E_RECRUITER_EMAIL and E2E_RECRUITER_PASSWORD.");
    await loginAs(page, "recruiter", "/notifications");
    await page.goto("/notifications");
    await expect(page.getByRole("heading", { name: /notifications/i }).first()).toBeVisible();
  });

  test("email processing endpoint rejects anonymous callers", async ({ request }) => {
    const response = await request.post("/api/email/process", { data: {} });
    expect(response.status()).toBe(401);
  });
});
