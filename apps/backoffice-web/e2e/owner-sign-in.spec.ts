import { type Page, expect, test } from "@playwright/test";
import { Secret, TOTP } from "otpauth";

/**
 * Slice happy paths, in order against one fresh backend (e2e/README.md):
 * - #11: the bootstrapped Owner signs in for the first time — temporary password, new password, MFA enrolment,
 *   recovery codes — reaches the shell, signs out, and signs in again with TOTP;
 * - #28: that Owner creates a Branch and activates it; #29: sets its opening hours and a special day.
 * The bootstrap Owner exists only until its password is changed, so the tests share its TOTP secret.
 */
test.describe.configure({ mode: "serial" });

let ownerTotp: TOTP | undefined;
const usedSteps = new Set<number>();
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
  ownerTotp = totp;
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
  // The account name comes from /auth/me, so it survives the reload (bootstrapped Owner: no display name → email).
  await expect(page.getByRole("button", { name: email })).toBeVisible();
});

test("Owner: creates a Branch and activates it (#28)", async ({ page }) => {
  test.skip(!ownerTotp, "Needs the Owner enrolled by the previous test");
  const totp = ownerTotp as TOTP;
  const code = `E2E-${Date.now().toString(36).toUpperCase()}`;

  await page.goto("/login");
  await logIn(page, newPassword);
  await page.getByLabel("Mã xác thực").fill(await freshCode(page, totp, usedSteps));
  await page.getByRole("button", { name: "Xác nhận" }).click();

  // Quản trị › Chi nhánh (D3c screen 14).
  const nav = page.getByRole("navigation", { name: "Điều hướng chính" });
  await nav.getByRole("link", { name: "Chi nhánh" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Chi nhánh" })).toBeVisible();
  await expect(page.getByText(/^\d+ chi nhánh$/)).toBeVisible();
  await snap(page, "14-branch-list");

  // Create (screen 15): starts DRAFT.
  await page.getByRole("link", { name: "Tạo chi nhánh" }).click();
  await page.getByLabel(/Mã chi nhánh/).fill(code);
  await page.getByLabel(/Tên hiển thị/).fill("HaYi E2E Nguyễn Huệ");
  await page.getByLabel(/Số nhà, đường/).fill("12 Nguyễn Huệ");
  await page.getByLabel(/Phường \/ xã/).fill("Bến Nghé");
  await page.getByLabel(/Quận \/ huyện/).fill("Quận 1");
  await page.getByLabel(/Tỉnh \/ thành/).fill("TP.HCM");
  await page.getByLabel(/Toạ độ/).fill("10.7757, 106.7019");
  await snap(page, "15-branch-create");
  await page.getByRole("button", { name: "Tạo chi nhánh" }).click();

  const summary = page.getByRole("region", { name: "Tóm tắt chi nhánh" });
  await expect(page.getByRole("heading", { level: 1, name: "HaYi E2E Nguyễn Huệ" })).toBeVisible();
  await expect(summary.getByText(code)).toBeVisible();
  await expect(summary.getByText("Nháp")).toBeVisible();
  await snap(page, "16-branch-detail-draft");

  // Activate: DRAFT → ACTIVE (Branch §4.3).
  await summary.getByRole("button", { name: "Kích hoạt" }).click();
  await expect(page.getByRole("status")).toContainText("Đã kích hoạt chi nhánh.");
  await expect(summary.getByText("Đang hoạt động")).toBeVisible();
  await snap(page, "16-branch-detail-active");

  // Opening hours (screen 17, #29): open Monday, save the week, then add a special day.
  await page.getByRole("link", { name: "Giờ mở cửa" }).click();
  const monday = page.getByRole("row", { name: /^Thứ Hai/ });
  const mondayClosed = monday.getByRole("checkbox", { name: /Đóng/ });
  if (await mondayClosed.isChecked()) await mondayClosed.uncheck();
  await monday.getByLabel("Thứ Hai khoảng 1 mở").fill("07:00");
  await monday.getByLabel("Thứ Hai khoảng 1 đóng").fill("21:30");
  await page.getByRole("button", { name: "Lưu lịch tuần" }).click();
  await expect(page.getByRole("status")).toContainText("Đã lưu lịch tuần.");

  const special = page.getByRole("form", { name: "Thêm ngày" });
  const nextMonth = new Date(Date.now() + 30 * 86_400_000).toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });
  await special.getByLabel("Ngày", { exact: true }).fill(nextMonth);
  await special.getByLabel("Giờ mở ngày đặc biệt").fill("08:00");
  await special.getByLabel("Giờ đóng ngày đặc biệt").fill("23:00");
  await special.getByLabel("Lý do").fill("Khai trương");
  await special.getByRole("button", { name: "Thêm ngày đặc biệt" }).click();
  await expect(page.getByRole("status")).toContainText("Đã lưu ngày đặc biệt");
  await expect(page.getByRole("list", { name: "Ngày đặc biệt sắp tới" }).getByText("Khai trương")).toBeVisible();
  await snap(page, "17-branch-hours");

  // Pickup windows (screen 13, #30): take orders on Monday mornings, then preview next Monday's slots.
  await page.getByRole("link", { name: "Khung giờ nhận đơn" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Khung giờ nhận đơn" })).toBeVisible();
  await page.getByRole("checkbox", { name: "Nhận đơn lấy tại quầy" }).check();
  const pickupMonday = page.getByRole("row", { name: /^Thứ Hai/ });
  await pickupMonday.getByRole("button", { name: "Thêm khung cho Thứ Hai" }).click();
  await pickupMonday.getByLabel("Thứ Hai khung 1 bắt đầu").fill("08:00");
  await pickupMonday.getByLabel("Thứ Hai khung 1 kết thúc").fill("11:00");
  await pickupMonday.getByLabel("Tối đa đơn Thứ Hai").fill("5");
  await page.getByRole("button", { name: "Lưu thay đổi" }).click();
  await expect(page.getByRole("status")).toContainText("Đã lưu khung giờ nhận đơn.");
  // Vietnam's wall clock as a local Date, so that adding days and formatting stay in Vietnam time.
  const vnNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
  const nextMonday = new Date(vnNow.getTime() + ((8 - vnNow.getDay()) % 7 || 7) * 86_400_000).toLocaleDateString("en-CA");
  await page.getByLabel("Ngày xem trước").fill(nextMonday);
  await expect(page.getByRole("list", { name: "Khung giờ khách thấy" }).getByRole("listitem").first()).toHaveText("08:00");
  await snap(page, "13-slot-config");
  await page.goBack();

  // The list shows it active.
  await page.getByRole("navigation", { name: "Vị trí" }).getByRole("link", { name: "Chi nhánh" }).click();
  const row = page.getByRole("row", { name: new RegExp(code) });
  await expect(row.getByText("Đang hoạt động")).toBeVisible();

  // Deactivate dialog (screen 18) on a Branch with no open commitments.
  await row.getByRole("link", { name: "Xem HaYi E2E Nguyễn Huệ" }).click();
  await summary.getByRole("button", { name: "Tạm ngưng…" }).click();
  const dialog = page.getByRole("dialog", { name: "Tạm ngưng HaYi E2E Nguyễn Huệ?" });
  await expect(dialog.getByText("Đã kiểm tra: không còn đơn hay phiên nhóm đang mở.")).toBeVisible();
  await snap(page, "18-branch-deactivate");
  await dialog.getByRole("button", { name: "Hủy" }).click();

  // Close dialog (screen 19): locked until the code is typed.
  await summary.getByRole("button", { name: "Đóng chi nhánh…" }).click();
  const close = page.getByRole("dialog", { name: "Đóng vĩnh viễn HaYi E2E Nguyễn Huệ?" });
  await expect(close.getByRole("button", { name: "Đóng chi nhánh" })).toBeDisabled();
  await close.getByLabel(/để xác nhận/).fill(code);
  await expect(close.getByRole("button", { name: "Đóng chi nhánh" })).toBeEnabled();
  await page.waitForTimeout(300); // let the button's colour transition finish for the screenshot
  await snap(page, "19-branch-close");
});
