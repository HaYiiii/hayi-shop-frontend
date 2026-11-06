import { type Page, expect, test } from "@playwright/test";

/**
 * Category tree (D3d screen 20, FE #44) happy path against a mocked API (no backend): reorder, add,
 * and an archive refused with CATALOG_CATEGORY_IN_USE. Set SHOTS_DIR to save the screenshots used in the PR.
 */

const me = {
  userId: "u-o",
  email: "owner@hayi.vn",
  displayName: "Ngọc Hà",
  mfaEnrolled: true,
  storeRoles: ["OWNER"],
  storePermissions: ["BRANCH_VIEW", "BRANCH_MANAGE", "STAFF_VIEW", "CATALOG_VIEW", "CATALOG_MANAGE"],
  branches: [],
};

const stamp = { description: null, status: "ACTIVE", version: 1, createdAt: "2026-11-01T03:00:00Z", updatedAt: "2026-11-01T03:00:00Z" };
const cat = (categoryId: string, name: string, slug: string, parentId: string | null, sortOrder: number) => ({
  ...stamp,
  categoryId,
  name,
  slug,
  parentId,
  sortOrder,
});

function initialTree() {
  return [
    { ...cat("matcha", "Matcha", "matcha", null, 1), children: [cat("m-latte", "Matcha latte", "matcha-latte", "matcha", 1), cat("m-ice", "Matcha đá xay", "matcha-da-xay", "matcha", 2)] },
    { ...cat("milk-tea", "Trà sữa", "tra-sua", null, 2), children: [cat("mt-classic", "Trà sữa truyền thống", "tra-sua-truyen-thong", "milk-tea", 1)] },
    { ...cat("coffee", "Cà phê", "ca-phe", null, 3), children: [] },
    { ...cat("cake", "Bánh", "banh", null, 4), children: [cat("cake-old", "Bánh mùa thu", "banh-mua-thu", "cake", 1)] },
    { ...cat("old", "Món cũ", "mon-cu", null, 9), status: "ARCHIVED", children: [] },
  ];
}

async function mockApi(page: Page) {
  let tree = initialTree();
  await page.route("**/api/backoffice/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/.*\/api\/backoffice\/v1/, "");
    const route_ = `${request.method()} ${path}`;
    if (route_ === "GET /auth/me") return route.fulfill({ json: me });
    if (route_ === "GET /branches") return route.fulfill({ json: { items: [] } });
    if (route_ === "GET /categories") return route.fulfill({ json: { items: tree } });
    if (route_ === "PUT /categories/order") {
      const { parentId, categoryIds } = request.postDataJSON() as { parentId: string | null; categoryIds: string[] };
      if (parentId === null) {
        const archived = tree.filter((c) => c.status !== "ACTIVE");
        tree = [...categoryIds.map((id) => tree.find((c) => c.categoryId === id)!), ...archived];
      }
      return route.fulfill({ json: { items: tree.filter((c) => c.status === "ACTIVE") } });
    }
    if (route_ === "POST /categories") {
      const body = request.postDataJSON() as { name: string; slug: string };
      const created = cat("new", body.name, body.slug, null, 10);
      tree = [...tree.filter((c) => c.status === "ACTIVE"), { ...created, children: [] }, ...tree.filter((c) => c.status !== "ACTIVE")];
      return route.fulfill({ status: 201, json: created, headers: { ETag: '"v1"' } });
    }
    if (route_ === "POST /categories/cake/archive") {
      return route.fulfill({ status: 409, contentType: "application/problem+json", body: JSON.stringify({ status: 409, code: "CATALOG_CATEGORY_IN_USE" }) });
    }
    return route.fulfill({ status: 404, json: { status: 404, code: "NOT_FOUND" } });
  });
}

async function shot(page: Page, name: string) {
  if (process.env.SHOTS_DIR) await page.screenshot({ path: `${process.env.SHOTS_DIR}/${name}.png` });
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await mockApi(page);
});

test("Owner reorders, adds and tries to archive a Category in use", async ({ page }) => {
  await page.goto("/admin/categories");
  await expect(page.getByRole("heading", { level: 1, name: "Danh mục" })).toBeVisible();
  await expect(page.getByText("4 nhóm · 4 danh mục con · tối đa 2 cấp")).toBeVisible();
  await shot(page, "20-categories");

  await page.getByRole("button", { name: "Chuyển Cà phê lên" }).click();
  await expect(page.getByRole("button", { name: "Chuyển Cà phê lên" })).toBeFocused();
  const roots = page.getByRole("list", { name: "Danh mục" }).locator(":scope > li > div");
  await expect(roots.nth(1)).toContainText("Cà phê");

  await page.getByLabel("Tên").fill("Trà trái cây");
  await expect(page.getByLabel("Đường dẫn (slug)")).toHaveValue("tra-trai-cay");
  await page.getByRole("button", { name: "Thêm danh mục" }).click();
  await expect(page.getByText("Đã thêm “Trà trái cây” vào cuối nhóm.")).toBeVisible();
  await expect(roots.nth(4)).toContainText("Trà trái cây");

  await page.getByRole("button", { name: "Lưu trữ Bánh…" }).click();
  await expect(page.getByRole("dialog", { name: "Lưu trữ “Bánh”?" })).toBeVisible();
  await shot(page, "20-archive-dialog");
  await page.getByRole("button", { name: "Lưu trữ danh mục" }).click();
  await expect(page.getByRole("alert")).toContainText("Chưa lưu trữ được “Bánh”: còn 1 danh mục con chưa lưu trữ");
  await shot(page, "20-in-use");

  await page.getByRole("button", { name: "Sửa Matcha latte" }).click();
  await expect(page.getByRole("form", { name: "Sửa “Matcha latte”" })).toBeVisible();
  await page.getByRole("button", { name: "Xem đã lưu trữ (1)" }).click();
  await expect(page.getByText("Món cũ")).toBeVisible();
  await expect(page).toHaveURL(/archived=1/);
  await shot(page, "20-edit-archived");
});
