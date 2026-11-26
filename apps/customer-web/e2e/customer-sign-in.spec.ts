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
  let profile = { customerId: "c", displayName: "Lan", phoneMasked: "+8490*****567", loyalty: null };
  let version = 1;
  let macSignedIn = true;
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
    // FE #72: profile with an ETag; the rename needs If-Match.
    // FE #74: devices; the Mac can be signed out.
    if (key === "GET /auth/sessions") {
      const items = [
        { sessionId: "s-this", userAgent: await request.headerValue("User-Agent"), ipAddress: null, createdAt: "2026-11-20T03:00:00Z", lastActiveAt: new Date().toISOString(), current: true },
        ...(macSignedIn
          ? [{ sessionId: "s-mac", userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36", ipAddress: null, createdAt: "2026-11-01T03:00:00Z", lastActiveAt: "2026-11-18T14:04:00Z", current: false }]
          : []),
      ];
      return route.fulfill({ json: { items } });
    }
    if (key === "DELETE /auth/sessions/s-mac") {
      macSignedIn = false;
      return route.fulfill({ status: 204 });
    }
    if (key === "GET /me/profile") return route.fulfill({ json: profile, headers: { ETag: `"${version}"` } });
    if (key === "PATCH /me/profile") {
      if ((await request.headerValue("If-Match")) !== `"${version}"`) return problem(412, "VERSION_CONFLICT");
      profile = { ...profile, ...(request.postDataJSON() as { displayName: string }) };
      version += 1;
      return route.fulfill({ json: profile, headers: { ETag: `"${version}"` } });
    }
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

test("Customer: the Tài khoản tab asks to sign in, then renames and signs out (FE #70, #72)", async ({ page }) => {
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
  await expect(page.getByRole("heading", { level: 1, name: "Tài khoản" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Điều hướng" }).getByRole("link", { name: "Tài khoản" })).toHaveAttribute("aria-current", "page");
  const card = page.getByRole("region", { name: "Hồ sơ" });
  await expect(card.getByText("Lan", { exact: true })).toBeVisible();
  await snap(page, "11-account");

  // FE #72: rename in place.
  await card.getByRole("button", { name: "Sửa tên" }).click();
  await card.getByLabel("Tên hiển thị").fill("Lan Anh");
  await snap(page, "11-account-edit");
  await card.getByRole("button", { name: "Lưu" }).click();
  await expect(card.getByRole("status")).toHaveText("Đã lưu tên.");
  await expect(card.getByText("Lan Anh", { exact: true })).toBeVisible();
  expect(seen.find((s) => s.route === "PATCH /me/profile")?.csrf).toBe("e2e-token");

  // FE #74: sign the Mac out after confirming.
  const devices = page.getByRole("region", { name: "Thiết bị đang đăng nhập" });
  await expect(devices.getByText("Dùng lần cuối 18/11, 21:04")).toBeVisible();
  await snap(page, "11-devices");
  await devices.getByRole("button", { name: "Đăng xuất Mac · Chrome" }).click();
  const confirm = page.getByRole("dialog", { name: "Đăng xuất Mac · Chrome?" });
  await snap(page, "11-devices-confirm");
  await confirm.getByRole("button", { name: "Đăng xuất" }).click();
  await expect(devices.getByRole("status")).toHaveText("Đã đăng xuất Mac · Chrome.");
  await expect(devices.getByText("Mac · Chrome", { exact: true })).toHaveCount(0);
  expect(seen.find((s) => s.route === "DELETE /auth/sessions/s-mac")?.csrf).toBe("e2e-token");

  await page.getByRole("button", { name: "Đăng xuất", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  expect(seen.find((s) => s.route === "POST /auth/logout")?.csrf).toBe("e2e-token");
});
