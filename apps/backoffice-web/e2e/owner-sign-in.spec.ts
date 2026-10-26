import { type Page, expect, test } from "@playwright/test";
import { Secret, TOTP } from "otpauth";

/**
 * Slice happy path (#11): the bootstrapped Owner signs in for the first time — temporary password,
 * new password, MFA enrolment, recovery codes — reaches the shell, signs out, and signs in again with TOTP.
 * Needs a fresh backend: the bootstrap Owner exists only until its password is changed (e2e/README.md).
 */
const email = process.env.E2E_OWNER_EMAIL ?? "owner@hayi.local";
const temporaryPassword = process.env.E2E_OWNER_TEMP_PASSWORD ?? "mat khau tam thoi 01";
const newPassword = process.env.E2E_OWNER_NEW_PASSWORD ?? "matcha sua tuoi e2e 2026";

async function logIn(page: Page, password: string) {
  await page.getByLabel("Email, mã nhân viên hoặc số điện thoại").fill(email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
}

/** Set E2E_SCREENSHOTS=<dir> to keep one screenshot per screen (design comparison in the PR). */
async function snap(page: Page, name: string) {
  const dir = process.env.E2E_SCREENSHOTS;
  if (dir) await page.screenshot({ path: `${dir}/${name}.png`, fullPage: true });
}

/** A code from a TOTP step the server has not seen yet (codes are single-use per step). */
async function freshCode(page: Page, totp: TOTP, used: Set<number>): Promise<string> {
  let counter = totp.counter();
  if (used.has(counter)) {
    await page.waitForTimeout(totp.remaining() + 1_000);
    counter = totp.counter();
  }
  used.add(counter);
  return totp.generate();
}

test("Owner: first sign-in with password change and MFA enrolment, then TOTP sign-in", async ({ page, context }) => {
  const usedSteps = new Set<number>();

  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Đăng nhập Backoffice" })).toBeVisible();
  await snap(page, "1-login");

  // Temporary password → set a new one (Decision K3) → sign in again.
  await logIn(page, temporaryPassword);
  await expect(page.getByRole("heading", { name: "Đặt mật khẩu mới" })).toBeVisible();
  await snap(page, "5-first-password");
  await page.getByLabel("Mật khẩu mới", { exact: true }).fill(newPassword);
  await page.getByLabel("Nhập lại mật khẩu mới").fill(newPassword);
  await page.getByRole("button", { name: "Lưu mật khẩu và tiếp tục" }).click();
  await expect(page.getByRole("status")).toContainText("Đã đổi mật khẩu");
  await page.getByLabel("Mật khẩu", { exact: true }).fill(newPassword);
  await page.getByRole("button", { name: "Đăng nhập" }).click();

  // STORE role must enrol TOTP (Decision D4, L2).
  await expect(page.getByRole("heading", { name: "Bật xác thực 2 lớp" })).toBeVisible();
  const secret = (await page.locator("code").innerText()).replace(/\s/g, "");
  await snap(page, "3-mfa-enroll");
  const totp = new TOTP({ secret: Secret.fromBase32(secret), digits: 6, period: 30, algorithm: "SHA1" });
  await page.getByLabel("Mã từ ứng dụng").fill(await freshCode(page, totp, usedSteps));
  await page.getByRole("button", { name: "Xác nhận và bật" }).click();

  await expect(page.getByRole("heading", { name: "Lưu mã khôi phục" })).toBeVisible();
  await expect(page.getByRole("listitem").first()).toHaveText(/\S+/);
  await snap(page, "4-recovery-codes");
  await page.getByLabel("Tôi đã lưu các mã ở nơi an toàn").check();
  await page.getByRole("button", { name: "Vào Backoffice" }).click();

  // Shell: store-wide scope and its store-level screens (Branch screens need a Branch in the URL).
  const nav = page.getByRole("navigation", { name: "Điều hướng chính" });
  await expect(page.getByRole("heading", { level: 1, name: "Nhân sự" })).toBeVisible();
  await expect(page).toHaveURL(/\/staff$/);
  await expect(page.getByText("Toàn hệ thống").first()).toBeVisible();
  await expect(nav.getByRole("link", { name: "Nhân sự" })).toHaveAttribute("aria-current", "page");
  await snap(page, "6-shell");

  // Sign out, then sign in with password + TOTP.
  await page.getByRole("button", { name: email }).click();
  await page.getByRole("menuitem", { name: "Đăng xuất" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/staff");
  await expect(page).toHaveURL(/\/login$/);

  await logIn(page, newPassword);
  await expect(page.getByRole("heading", { name: "Xác thực 2 lớp" })).toBeVisible();
  await snap(page, "2-mfa");
  await page.getByLabel("Mã xác thực").fill(await freshCode(page, totp, usedSteps));
  await page.getByRole("button", { name: "Xác nhận" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Nhân sự" })).toBeVisible();

  // Access cookie gone (as after its 10-minute Max-Age): the client refreshes once and carries on (§5).
  await context.clearCookies({ name: "hy_b_at" });
  const refreshed = page.waitForResponse((r) => r.url().endsWith("/auth/refresh") && r.status() === 204);
  await page.reload();
  await refreshed;
  await expect(nav.getByRole("link", { name: "Nhân sự" })).toBeVisible();
});
