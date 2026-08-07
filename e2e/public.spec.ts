import { expect, test } from "@playwright/test";
import { waitForSearchSettle } from "./fixtures";

test.describe("public pages and authentication entry points", () => {
  test("home page renders branded navigation and primary calls to action", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/JobForge/i);
    await expect(page.getByRole("link", { name: /jobs/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /pricing/i }).first()).toBeVisible();
  });

  test("public route inventory is reachable", async ({ page }) => {
    const routes = ["/jobs", "/pricing", "/login", "/signup", "/forgot-password", "/reset-password"];
    for (const route of routes) {
      const response = await page.goto(route);
      expect(response?.status(), route).toBeLessThan(400);
      await expect(page.locator("body")).toBeVisible();
    }
  });

  test("jobs search supports optional filters without a document reload", async ({ page }) => {
    await page.goto("/jobs");
    await expect(page.getByRole("heading", { name: "Browse Jobs" })).toBeVisible();

    let loadEvents = 0;
    page.on("load", () => {
      loadEvents += 1;
    });
    const initialLoadEvents = loadEvents;

    const search = page.locator("#public-job-search");
    const location = page.locator("#public-job-location");
    const category = page.locator("#public-job-category");
    await expect(search).toBeVisible();
    await expect(location).toBeVisible();
    await expect(category).toBeVisible();

    await search.fill("Designer");
    await waitForSearchSettle(page);
    await expect(search).toHaveValue("Designer");
    await location.fill("Delhi");
    await waitForSearchSettle(page);
    await expect(location).toHaveValue("Delhi");
    await category.fill("Engineering");
    await waitForSearchSettle(page);
    expect(loadEvents).toBe(initialLoadEvents);
  });

  test("advanced job filters are collapsed and optional", async ({ page }) => {
    await page.goto("/jobs");
    const toggle = page.getByRole("button", { name: /More filters/i });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator("#public-job-employment")).toBeVisible();
    await expect(page.locator("#public-job-workplace")).toBeVisible();
    await expect(page.locator("#public-job-experience")).toBeVisible();
    await expect(page.locator("#public-job-sort")).toBeVisible();
  });

  test("jobs clear filters restores the default search state", async ({ page }) => {
    await page.goto("/jobs");
    await page.locator("#public-job-search").fill("nonexistent-e2e-query");
    await waitForSearchSettle(page);
    const clear = page.locator("form").getByRole("button", { name: /clear filters/i });
    await expect(clear).toBeVisible();
    await clear.click();
    await expect(page.locator("#public-job-search")).toHaveValue("");
  });

  test("public jobs pagination and empty states are structurally accessible", async ({ page }) => {
    await page.goto("/jobs");
    const pagination = page.getByRole("navigation", { name: /jobs pagination/i });
    if (await pagination.count()) {
      await expect(pagination).toBeVisible();
    }
    await expect(page.locator("main").first()).toBeVisible();
  });

  test("robots and sitemap are served as crawlable text responses", async ({ request }) => {
    const robots = await request.get("/robots.txt");
    expect(robots.status()).toBe(200);
    const robotsText = await robots.text();
    expect(robotsText).toMatch(/sitemap|disallow:\s*\//i);

    const sitemap = await request.get("/sitemap.xml");
    expect(sitemap.status()).toBe(200);
    expect(await sitemap.text()).toMatch(/<urlset|<sitemapindex/i);
  });

  test("unknown route returns a real not-found response", async ({ page }) => {
    const response = await page.goto("/e2e-route-that-does-not-exist");
    expect(response?.status()).toBe(404);
  });
});
