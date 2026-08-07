import { expect, test } from "@playwright/test";
import { hasCredentials, loginAs } from "./fixtures";

test.describe("admin workflow and role isolation", () => {
  test("configured admin can reach protected admin sections", async ({ page }) => {
    test.skip(!hasCredentials("admin"), "Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD.");
    await loginAs(page, "admin", "/admin");
    await page.goto("/admin");
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByRole("navigation", { name: /admin navigation/i })).toBeVisible();
    for (const path of ["/admin/users", "/admin/companies", "/admin/jobs", "/admin/applications", "/admin/payments", "/admin/moderation"]) {
      await page.goto(path);
      await expect(page).not.toHaveURL(/\/login/);
    }
  });

  test("admin API rejects anonymous access", async ({ request }) => {
    const response = await request.get("/api/admin/users");
    expect(response.status()).toBe(401);
  });

  test("admin mutation API rejects anonymous access", async ({ request }) => {
    const response = await request.post("/api/admin/moderation", { data: { action: "approve", id: "not-a-real-id" } });
    expect(response.status()).toBe(401);
  });
});
