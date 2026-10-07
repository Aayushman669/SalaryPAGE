import { expect, test } from "@playwright/test";
import { hasCredentials, loginAs } from "./fixtures";

test("profile dropdown opens fully above the sidebar account card", async ({ page }) => {
  test.skip(!hasCredentials("candidate"), "Set candidate E2E credentials for profile menu tests.");

  await loginAs(page, "candidate", "/dashboard");

  const trigger = page.getByRole("button", { name: "Account menu" });
  await expect(trigger).toBeVisible();
  await trigger.click();

  const menu = page.getByRole("menu", { name: "Account menu" });
  await expect(menu).toBeVisible();

  for (const label of ["Theme", "Switch Role", "Settings", "Plans", "Logout"]) {
    await expect(menu.getByRole("menuitem", { name: label })).toBeVisible();
  }

  const box = await menu.boundingBox();
  expect(box).not.toBeNull();

  if (box) {
    const viewport = page.viewportSize();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport?.width ?? 0);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport?.height ?? 0);
  }

  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
});
