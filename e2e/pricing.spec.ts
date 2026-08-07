import { expect, test } from "@playwright/test";

test.describe("pricing and entitlement presentation", () => {
  test("pricing uses the configured recruiter plans and exposes actionable CTAs", async ({ page }) => {
    await page.goto("/pricing");
    await expect(page.getByRole("heading", { name: /simple plans for every hiring stage/i })).toBeVisible();
    for (const plan of ["Starter", "Growth", "Pro"]) {
      await expect(page.getByText(plan, { exact: true }).first()).toBeVisible();
    }
    await expect(page.getByRole("button", { name: /choose|select|get started|upgrade|view plans/i }).first()).toBeVisible();
  });

  test("pricing payment APIs remain protected from anonymous callers", async ({ request }) => {
    const createOrder = await request.post("/api/create-order", { data: { plan: "pro" } });
    const verifyPayment = await request.post("/api/verify-payment", { data: { plan: "pro" } });
    expect(createOrder.status()).toBe(401);
    expect(verifyPayment.status()).toBe(401);
  });
});
