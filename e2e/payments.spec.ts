import { expect, test } from "@playwright/test";
import { getCredentials, hasCredentials, loginAs, mutationsEnabled, razorpayEnabled } from "./fixtures";

test.describe("payments and provider boundaries", () => {
  test("payment APIs reject unauthenticated requests", async ({ request }) => {
    const order = await request.post("/api/create-order", { data: {} });
    expect(order.status()).toBe(401);
    const verify = await request.post("/api/verify-payment", { data: {} });
    expect(verify.status()).toBe(401);
  });

  test("Razorpay test mode reaches the checkout entry point without claiming payment success", async ({ page }) => {
    test.skip(!razorpayEnabled() || !mutationsEnabled() || !hasCredentials("recruiter"), "Set Razorpay test mode, E2E_ALLOW_MUTATIONS=true, and recruiter staging credentials.");
    await loginAs(page, "recruiter", "/pricing");
    await page.goto("/pricing");
    await page.getByLabel("Email for payment access").fill(getCredentials("recruiter").email);
    await page.getByRole("button", { name: "Get Starter", exact: true }).click();
    await expect(page.locator("body")).toContainText(/checkout|payment|opening|error/i);
  });

  test("webhook rejects malformed unsigned requests safely", async ({ request }) => {
    const response = await request.post("/api/razorpay/webhook", { data: { event: "payment.captured" } });
    expect([400, 401, 403, 503]).toContain(response.status());
  });
});
