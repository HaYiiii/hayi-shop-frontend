import { type Page, expect, test } from "@playwright/test";

/**
 * FE #70 (D3a screen 8): sign-in happy path against a mocked Customer API (no backend). The browser calls
 * `/api/customer` on this origin, so `page.route` answers it. Set E2E_SCREENSHOTS=<dir> to keep screenshots.
 */

async function snap(page: Page, name: string) {
  const dir = process.env.E2E_SCREENSHOTS;
  if (dir) await page.screenshot({ path: `${dir}/${name}.png`, fullPage: true });
}

async function mockCustomerApi(page: Page) {
  let signedIn = false;
  const seen: { route: string; csrf: string | null }[] = [];
  await page.route("**/api/customer/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace("/api/customer/v1", "");
    const key = `${request.method()} ${path}`;
    seen.push({ route: key, csrf: (await request.headerValue("X-CSRF-Token")) ?? null });
    const problem = (status: number, code: string) =>
      route.fulfill({ status, contentType: "application/problem+json", body: JSON.stringify({ status, code }) });
    if (key === "GET /auth/me") {
      return signedIn
        ? route.fulfill({ json: { userId: "u", customerId: "c", displayName: "Lan", phoneMasked: "+8490*****567" } })
        : problem(401, "AUTH_REQUIRED");
    }
    if (key === "POST /auth/refresh") return problem(401, "AUTH_REQUIRED");
    if (key === "POST /auth/login") {
      const body = request.postDataJSON() as { phone: string; password: string };
      if (body.password !== "mat khau dung") return problem(401, "AUTH_INVALID_CREDENTIALS");
      signedIn = true;
      // The real API sets hy_c_at / hy_c_rt (HttpOnly) and hy_c_csrf here; the CSRF one is readable by JS.
      return route.fulfill({
        json: { verificationRequired: false, challengeId: null },
        headers: { "Set-Cookie": "hy_c_csrf=e2e-token; Path=/; SameSite=Lax" },
      });
    }
    if (key === "POST /auth/logout") {
      signedIn = false;
      return route.fulfill({ status: 204 });
    }
    return problem(404, "NOT_FOUND");
  });
  return seen;
}

test("Customer: the Tài khoản tab asks to sign in, then shows the account", async ({ page }) => {
  const seen = await mockCustomerApi(page);
  await page.goto("/account");
  await expect(page).toHaveURL(/\/login\?next=%2Faccount$/);
  await expect(page.getByRole("heading", { level: 1, name: "Chào bạn trở lại" })).toBeVisible();

  await page.getByLabel("Số điện thoại").fill("0901 234 567");
  await page.getByLabel("Mật khẩu").fill("sai");
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page.getByRole("form", { name: "Đăng nhập" }).getByRole("alert")).toHaveText("Số điện thoại hoặc mật khẩu chưa đúng.");
  await snap(page, "8-login-wrong");

  await page.getByLabel("Mật khẩu").fill("mat khau dung");
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByRole("heading", { level: 1, name: "Chào Lan" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Điều hướng" }).getByRole("link", { name: "Tài khoản" })).toHaveAttribute("aria-current", "page");
  await snap(page, "11-account-minimal");

  await page.getByRole("button", { name: "Đăng xuất" }).click();
  await expect(page).toHaveURL(/\/$/);
  expect(seen.find((s) => s.route === "POST /auth/logout")?.csrf).toBe("e2e-token");
});
