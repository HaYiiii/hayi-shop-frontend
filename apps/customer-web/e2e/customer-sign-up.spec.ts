import { type Page, expect, test } from "@playwright/test";

/**
 * FE #71 (screen 8 code step, D3f 8b/8c): sign-up happy path against a mocked Customer API (no backend). The
 * browser calls `/api/customer` on this origin, so `page.route` answers it. Set E2E_SCREENSHOTS=<dir> to keep shots.
 */

async function snap(page: Page, name: string) {
  const dir = process.env.E2E_SCREENSHOTS;
  if (dir) await page.screenshot({ path: `${dir}/${name}.png`, fullPage: true });
}

async function mockCustomerApi(page: Page) {
  const bodies: Record<string, unknown> = {};
  await page.route("**/api/customer/v1/**", async (route) => {
    const request = route.request();
    const key = `${request.method()} ${new URL(request.url()).pathname.replace("/api/customer/v1", "")}`;
    bodies[key] = request.postDataJSON();
    if (key === "POST /auth/otp") {
      return route.fulfill({ status: 202, json: { challengeId: "ch-1", expiresAt: new Date(Date.now() + 300_000).toISOString(), resendAfterSeconds: 60 } });
    }
    if (key === "POST /auth/otp/verify") {
      const { code } = request.postDataJSON() as { code: string };
      return code === "582104"
        ? route.fulfill({ json: { verificationToken: "vt-1", expiresAt: new Date(Date.now() + 600_000).toISOString() } })
        : route.fulfill({ status: 401, contentType: "application/problem+json", body: JSON.stringify({ status: 401, code: "OTP_CODE_INVALID" }) });
    }
    if (key === "POST /auth/register") return route.fulfill({ status: 201, json: { customerId: "c-1" } });
    return route.fulfill({ status: 404, contentType: "application/problem+json", body: JSON.stringify({ status: 404, code: "NOT_FOUND" }) });
  });
  return bodies;
}

test("Customer: signs up with a phone code, then is asked to sign in", async ({ page }) => {
  const bodies = await mockCustomerApi(page);
  await page.goto("/login");
  await page.getByRole("link", { name: "Đăng ký bằng số điện thoại" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Tạo tài khoản" })).toBeVisible();
  await page.getByLabel("Số điện thoại").fill("0901 234 567");
  await snap(page, "8a-sign-up-phone");
  await page.getByRole("button", { name: "Gửi mã" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Nhập mã xác minh" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Gửi lại mã sau 0:\d\d|Gửi lại mã sau 1:00/ })).toBeDisabled();
  await page.getByLabel("Mã xác minh").fill("111111");
  await page.getByRole("button", { name: "Xác minh" }).click();
  await expect(page.getByText("Mã chưa đúng. Bạn còn 4 lần thử.")).toBeVisible();
  await snap(page, "8c-code-wrong");
  await page.getByLabel("Mã xác minh").fill("582104");
  await page.getByRole("button", { name: "Xác minh" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Hoàn tất tài khoản" })).toBeVisible();
  await page.getByLabel("Tên hiển thị").fill("Ngọc Hà");
  await page.getByLabel("Mật khẩu").fill("tra sua matcha");
  await snap(page, "8b-details");
  await page.getByRole("button", { name: "Tạo tài khoản" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Chào bạn trở lại" })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Đã tạo tài khoản.");
  await expect(page.getByLabel("Số điện thoại")).toHaveValue("0901234567");
  expect(bodies["POST /auth/register"]).toEqual({ verificationToken: "vt-1", displayName: "Ngọc Hà", password: "tra sua matcha" });
});
