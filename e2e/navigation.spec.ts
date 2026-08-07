import { expect, test } from "@playwright/test";
import { expectProtectedRedirect, hasCredentials, loginAs } from "./fixtures";

test.describe("navigation and access boundaries", () => {
  test("protected pages redirect anonymous users to login with an intended path", async ({ page }) => {
    for (const path of ["/dashboard", "/applications", "/interviews", "/notifications", "/settings", "/post-job", "/saved-jobs", "/job-alerts"]) {
      await expectProtectedRedirect(page, path);
    }
  });

  test("home and jobs navigation use real internal destinations", async ({ page }) => {
    await page.goto("/");
    const hrefs = await page.locator("a[href]").evaluateAll((links) => links.map((link) => link.getAttribute("href")));
    expect(hrefs.some((href) => href === "/jobs" || href?.startsWith("/jobs?"))).toBeTruthy();
    expect(hrefs.some((href) => href === "/pricing" || href?.startsWith("/pricing?"))).toBeTruthy();
    expect(hrefs).not.toContain("#");
  });

  test("configured recruiter can open and collapse the sidebar", async ({ page }) => {
    test.skip(!hasCredentials("recruiter"), "Set recruiter E2E credentials for protected navigation tests.");
    await loginAs(page, "recruiter");
    const closeSidebar = page.getByRole("button", { name: "Close sidebar" });
    if (await closeSidebar.isVisible().catch(() => false)) {
      await closeSidebar.click();
      await expect(page.getByRole("button", { name: "Open sidebar" }).first()).toBeVisible();
    }
  });
});
