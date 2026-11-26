import { type Page, expect, test } from "@playwright/test";

/**
 * FE #73 (D3f 8d, screen 12): forgot-password happy path, and changing the password while signed in, against a
 * mocked Customer API (no backend). Set E2E_SCREENSHOTS=<dir> to keep screenshots.
 */

async function snap(page: Page, name: string) {
  const dir = process.env.E2E_SCREENSHOTS;
  if (dir) await page.screenshot({ path: `${dir}/${name}.png`, fullPage: true });
}

async function mockCustomerApi(page: Page, { signedIn = false } = {}) {
  const bodies: Record<string, unknown> = {};
  await page.route("**/api/customer/v1/**", async (route) => {
    const request = route.request();
    const key = `${request.method()} ${new URL(request.url()).pathname.replace("/api/customer/v1", "")}`;
    bodies[key] = request.postDataJSON();
    const problem = (status: number, code: string) =>
      route.fulfill({ status, contentType: "application/problem+json", body: JSON.stringify({ status, code }) });
    if (key === "POST /auth/otp") {
      return route.fulfill({ status: 202, json: { challengeId: "ch-1", expiresAt: new Date(Date.now() + 300_000).toISOString(), resendAfterSeconds: 60 } });
    }
    if (key === "POST /auth/otp/verify") return route.fulfill({ json: { verificationToken: "vt-r", expiresAt: new Date(Date.now() + 600_000).toISOString() } });
    if (key === "POST /auth/password/reset") return route.fulfill({ status: 204 });
    if (key === "GET /auth/me") {
      return signedIn ? route.fulfill({ json: { userId: "u", customerId: "c", displayName: "Lan", phoneMasked: "+8490*****567" } }) : problem(401, "AUTH_REQUIRED");
    }
    if (key === "POST /auth/refresh") return problem(401, "AUTH_REQUIRED");
    if (key === "GET /me/profile") {
      return route.fulfill({ json: { customerId: "c", displayName: "Lan", phoneMasked: "+8490*****567", loyalty: null }, headers: { ETag: '"1"' } });
    }
    if (key === "POST /auth/password/change") {
      const { currentPassword } = request.postDataJSON() as { currentPassword: string };
      return currentPassword === "mat khau cu 1" ? route.fulfill({ status: 204 }) : problem(401, "AUTH_INVALID_CREDENTIALS");
    }
    return problem(404, "NOT_FOUND");
  });
  return bodies;
}

test("Customer: forgets the password, sets a new one with a code, then is asked to sign in", async ({ page }) => {
  const bodies = await mockCustomerApi(page);
  await page.goto("/login");
  await page.getByRole("link", { name: "Quên mật khẩu?" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Quên mật khẩu" })).toBeVisible();
  await page.getByLabel("Số điện thoại").fill("0901 234 567");
  await snap(page, "8d-forgot-phone");
  await page.getByRole("button", { name: "Gửi mã" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Nhập mã xác minh" })).toBeVisible();
  await page.getByLabel("Mã xác minh", { exact: true }).fill("582104");
  await page.getByRole("button", { name: "Xác minh" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Đặt mật khẩu mới" })).toBeVisible();
  await page.getByLabel("Mật khẩu mới").fill("tra sua matcha 2");
  await snap(page, "8d-forgot-new-password");
  await page.getByRole("button", { name: "Lưu mật khẩu" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Đã đổi mật khẩu" })).toBeVisible();
  await snap(page, "8d-forgot-done");
  expect(bodies["POST /auth/otp"]).toEqual({ phone: "0901234567", purpose: "PASSWORD_RECOVERY" });
  expect(bodies["POST /auth/password/reset"]).toEqual({ verificationToken: "vt-r", newPassword: "tra sua matcha 2" });
  await page.getByRole("link", { name: "Đăng nhập" }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("Customer: changes the password from the account screen", async ({ page }) => {
  await mockCustomerApi(page, { signedIn: true });
  await page.goto("/account");
  await page.getByRole("link", { name: "Đổi mật khẩu" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Đổi mật khẩu" })).toBeVisible();
  await page.getByLabel("Mật khẩu hiện tại").fill("sai");
  await page.getByLabel("Mật khẩu mới").fill("mat khau moi 2");
  await page.getByRole("button", { name: "Lưu mật khẩu" }).click();
  await expect(page.getByText("Mật khẩu hiện tại chưa đúng.")).toBeVisible();
  await snap(page, "12-change-wrong");
  await page.getByLabel("Mật khẩu hiện tại").fill("mat khau cu 1");
  await page.getByRole("button", { name: "Lưu mật khẩu" }).click();
  await expect(page.getByText("Đã đổi mật khẩu. Các thiết bị khác đã được đăng xuất.")).toBeVisible();
  // Shown once: the URL drops ?password=changed (#88 review).
  await expect(page).toHaveURL(/\/account$/);
});
