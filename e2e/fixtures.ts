import { expect, type Page } from "@playwright/test";

export type E2ERole = "candidate" | "recruiter" | "admin";

type Credentials = {
  email: string;
  password: string;
};

const credentials: Record<E2ERole, Credentials> = {
  candidate: {
    email: process.env.E2E_CANDIDATE_EMAIL ?? "",
    password: process.env.E2E_CANDIDATE_PASSWORD ?? "",
  },
  recruiter: {
    email: process.env.E2E_RECRUITER_EMAIL ?? "",
    password: process.env.E2E_RECRUITER_PASSWORD ?? "",
  },
  admin: {
    email: process.env.E2E_ADMIN_EMAIL ?? "",
    password: process.env.E2E_ADMIN_PASSWORD ?? "",
  },
};

export function getCredentials(role: E2ERole) {
  return credentials[role];
}

export function hasCredentials(role: E2ERole) {
  const value = credentials[role];
  return Boolean(value.email && value.password);
}

export function mutationsEnabled() {
  return process.env.E2E_ALLOW_MUTATIONS === "true";
}

export function razorpayEnabled() {
  return process.env.E2E_RAZORPAY_ENABLED === "true";
}

export async function loginAs(page: Page, role: E2ERole, nextPath?: string) {
  const value = getCredentials(role);
  if (!value.email || !value.password) {
    throw new Error(`Missing E2E credentials for ${role}.`);
  }

  const next = nextPath ? `?next=${encodeURIComponent(nextPath)}` : "";
  await page.goto(`/login${next}`);
  await page.getByLabel("Email Address").fill(value.email);
  await page.getByLabel("Password").fill(value.password);
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await expect(page).not.toHaveURL(/\/login(?:[/?#]|$)/);
}

export async function logoutFromSidebar(page: Page) {
  const accountMenu = page.getByRole("button", { name: "Account menu" });
  if (await accountMenu.isVisible().catch(() => false)) {
    await accountMenu.click();
  }

  const logout = page.getByRole("button", { name: /^(Logout|Log out|Sign out)$/i }).first();
  await expect(logout).toBeVisible();
  await logout.click();
  await expect(page).toHaveURL(/\/(?:login)?(?:[/?#]|$)/);
}

export async function expectProtectedRedirect(page: Page, path: string) {
  await page.goto(path);
  await expect(page).toHaveURL(/\/login\?next=/);
}

export async function waitForSearchSettle(page: Page) {
  await page.waitForTimeout(650);
}

export function uniqueTestLabel(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
