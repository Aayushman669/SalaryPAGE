import { expect, test } from "@playwright/test";

test.describe("API method and authorization boundaries", () => {
  test("mutation-only endpoints reject GET requests", async ({ request }) => {
    for (const path of ["/api/create-order", "/api/verify-payment", "/api/razorpay/webhook", "/api/email/process", "/api/jobs/publish-scheduled"]) {
      const response = await request.get(path);
      expect(response.status(), path).toBe(405);
    }
  });

  test("authenticated-data endpoints do not disclose data anonymously", async ({ request }) => {
    for (const path of ["/api/billing", "/api/recruiter/jobs", "/api/admin/users"]) {
      const response = await request.get(path);
      expect([401, 403]).toContain(response.status());
    }
  });
});
