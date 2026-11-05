import { type Page, expect, test } from "@playwright/test";

/**
 * Form layout (D2 "Bố cục form", FE #41): fields in a Field.Group row keep their controls on one line, whatever
 * their labels and messages, and an error does not move the rows. Runs against a mocked API (no backend):
 * layout needs a real browser, jsdom cannot measure it.
 */

const perms = ["BRANCH_VIEW", "BRANCH_MANAGE", "BRANCH_LIFECYCLE_MANAGE"];
const me = {
  userId: "u-o",
  email: "owner@hayi.vn",
  displayName: "Chủ tiệm",
  mfaEnrolled: true,
  storeRoles: ["OWNER"],
  storePermissions: perms,
  branches: [],
};
const branch = {
  branchId: "b-q1",
  branchCode: "Q1-LELOI",
  name: "Quận 1 · Lê Lợi",
  status: "ACTIVE",
  address: { line: "68 Lê Lợi", ward: "Bến Nghé", district: "Quận 1", province: "TP.HCM" },
  location: null,
  phone: null,
  email: "q1@hayi.vn",
  timezone: "Asia/Ho_Chi_Minh",
  activatedAt: "2026-09-02T03:00:00Z",
  closedAt: null,
  createdAt: "2026-08-28T03:00:00Z",
  version: 3,
};

async function mockApi(page: Page) {
  await page.route("**/api/backoffice/v1/**", (route) => {
    const path = new URL(route.request().url()).pathname.replace(/.*\/api\/backoffice\/v1/, "");
    if (route.request().method() === "POST" && path === "/branches") {
      // Short (one-line) field errors on a left and a right field of different rows.
      return route.fulfill({
        status: 400,
        contentType: "application/problem+json",
        body: JSON.stringify({
          status: 400,
          code: "VALIDATION_FAILED",
          errors: [
            { field: "address.ward", code: "INVALID", message: "Phường chưa đúng." },
            { field: "email", code: "INVALID", message: "Email chưa đúng." },
          ],
        }),
      });
    }
    const bodies: Record<string, unknown> = { "/auth/me": me, "/branches": { items: [branch] }, "/branches/b-q1": branch };
    return path in bodies
      ? route.fulfill({ json: bodies[path], headers: { ETag: '"v3"' } })
      : route.fulfill({ status: 404, json: { status: 404, code: "NOT_FOUND" } });
  });
}

/** For every Field.Group row: the tops of its controls. */
async function controlTopsByRow(page: Page) {
  return page.$$eval("[data-slot=field-group]", (groups) =>
    groups.flatMap((group) => {
      const rows = new Map<number, number[]>();
      for (const field of group.querySelectorAll(":scope > [data-slot=field]")) {
        const control = field.querySelector("input, select, [data-slot=field-control]");
        if (!control) continue;
        const row = Math.round(field.getBoundingClientRect().top);
        rows.set(row, [...(rows.get(row) ?? []), Math.round(control.getBoundingClientRect().top)]);
      }
      return [...rows.values()];
    }),
  );
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await mockApi(page);
});

test("fields of a row share one control line, with and without errors (screen 15)", async ({ page }) => {
  await page.goto("/admin/branches/new");
  const code = page.getByLabel(/Mã chi nhánh/);
  await expect(code).toBeVisible();

  const before = await controlTopsByRow(page);
  expect(before.length).toBeGreaterThan(2);
  for (const row of before) expect(new Set(row).size).toBe(1);

  // The hint of "Mã chi nhánh" wraps while the one next to it does not; the server then puts an error under one
  // field of a row ("Phường / xã", left) and of another ("Email", right).
  await page.getByLabel(/Tên hiển thị/).fill("Quận 7");
  await code.fill("Q7-NGUYENTHI");
  await page.getByLabel(/Số nhà, đường/).fill("12 Nguyễn Thị Thập");
  await page.getByLabel(/Phường \/ xã/).fill("?");
  await page.getByLabel(/Tỉnh \/ thành/).fill("TP.HCM");
  await page.getByLabel("Email").fill("q7@hayi");
  await page.getByRole("button", { name: "Tạo chi nhánh" }).click();
  await expect(page.getByText("Phường chưa đúng.")).toBeVisible();
  await expect(page.getByText("Email chưa đúng.")).toBeVisible();

  const after = await controlTopsByRow(page);
  for (const row of after) expect(new Set(row).size).toBe(1);
  // The kept message line: an error does not change the distance between rows.
  const gaps = (rows: number[][]) => rows.slice(1).map((row, i) => row[0]! - rows[i]![0]!);
  expect(gaps(after)).toEqual(gaps(before));
});

test("lifecycle facts sit in the page summary, the form keeps its rows (screen 16)", async ({ page }) => {
  await page.goto("/admin/branches/b-q1");
  await expect(page.getByRole("list", { name: "Vòng đời" })).toBeVisible();
  await expect(page.getByRole("complementary")).toHaveCount(0);
  for (const row of await controlTopsByRow(page)) expect(new Set(row).size).toBe(1);
});
