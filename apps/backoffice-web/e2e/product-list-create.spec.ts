import { type Page, expect, test } from "@playwright/test";

/**
 * Product list and create (D3d screens 21–22, FE #46) happy path against a mocked API (no backend):
 * filter, a taken SKU on its field, then create and land on the Product. Set SHOTS_DIR to save the
 * screenshots used in the PR.
 */

const me = {
  userId: "u-o",
  email: "owner@hayi.vn",
  displayName: "Ngọc Hà",
  mfaEnrolled: true,
  storeRoles: ["OWNER"],
  storePermissions: ["BRANCH_VIEW", "BRANCH_MANAGE", "STAFF_VIEW", "CATALOG_VIEW", "CATALOG_MANAGE", "CATALOG_PRICE_MANAGE"],
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
const tree = [
  { ...cat("matcha", "Matcha", "matcha", null, 1), children: [cat("m-latte", "Matcha latte", "matcha-latte", "matcha", 1), cat("m-ice", "Matcha đá xay", "matcha-da-xay", "matcha", 2)] },
  { ...cat("milk-tea", "Trà sữa", "tra-sua", null, 2), children: [cat("mt-classic", "Trà sữa truyền thống", "tra-sua-truyen-thong", "milk-tea", 1)] },
  { ...cat("coffee", "Cà phê", "ca-phe", null, 3), children: [] },
  { ...cat("cake", "Bánh", "banh", null, 4), children: [] },
];

const summary = (productId: string, name: string, productCode: string, status: string, primaryCategoryId: string, fromPrice: number, variantCount: number, updatedAt: string) => ({
  productId,
  productCode,
  slug: productId,
  name,
  productType: "STANDARD",
  status,
  primaryCategoryId,
  fromPrice,
  variantCount,
  updatedAt,
  version: 1,
});
const products = [
  summary("bac-xiu", "Bạc Xỉu", "BAC-XIU", "INACTIVE", "coffee", 35000, 1, "2026-10-28T03:00:00Z"),
  summary("cake-matcha", "Bánh Bông Lan Matcha", "CAKE-MATCHA", "ACTIVE", "cake", 39000, 1, "2026-10-20T03:00:00Z"),
  summary("hojicha-oat", "Hojicha Sữa Yến Mạch", "HOJICHA-OAT", "ACTIVE", "mt-classic", 49000, 2, "2026-11-02T03:00:00Z"),
  summary("matcha-latte", "Matcha Latte", "MATCHA-LATTE", "ACTIVE", "m-latte", 45000, 2, "2026-11-04T03:00:00Z"),
  summary("matcha-dx-km", "Matcha Đá Xay Kem Muối", "MATCHA-DX-KEMMUOI", "DRAFT", "m-ice", 55000, 2, "2026-11-05T03:00:00Z"),
  summary("ts-khoaimon", "Trà Sữa Khoai Môn", "TS-KHOAIMON", "ARCHIVED", "mt-classic", 42000, 2, "2026-09-01T03:00:00Z"),
];

const created = {
  productId: "matcha-dx-dua",
  productCode: "MATCHA-DX-DUA",
  slug: "matcha-da-xay-dua",
  name: "Matcha Đá Xay Dừa",
  productType: "STANDARD",
  status: "DRAFT",
  primaryCategoryId: "m-ice",
  shortDescription: "Matcha Uji xay đá với nước cốt dừa.",
  description: null,
  sortOrder: 0,
  archivedAt: null,
  createdAt: "2026-11-18T03:00:00Z",
  updatedAt: "2026-11-18T03:00:00Z",
  version: 0,
  variants: [
    { variantId: "v-m", sku: "MATCHA-DX-DUA-M", name: "M", basePrice: 55000, isDefault: true, status: "ACTIVE", sortOrder: 0 },
    { variantId: "v-l", sku: "MATCHA-DX-DUA-L", name: "L", basePrice: 65000, isDefault: false, status: "ACTIVE", sortOrder: 1 },
  ],
  optionGroups: [],
  optionItemOverrides: [],
  images: [],
  sellingSchedules: [],
};

async function mockApi(page: Page) {
  let attempts = 0;
  await page.route("**/api/backoffice/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/.*\/api\/backoffice\/v1/, "");
    const route_ = `${request.method()} ${path}`;
    if (route_ === "GET /auth/me") return route.fulfill({ json: me });
    if (route_ === "GET /branches") return route.fulfill({ json: { items: [] } });
    if (route_ === "GET /categories") return route.fulfill({ json: { items: tree } });
    if (route_ === "GET /products") {
      const status = url.searchParams.get("status");
      const items = status ? products.filter((p) => p.status === status) : products;
      return route.fulfill({ json: { items, page: { number: 0, size: 20, totalItems: items.length, totalPages: 1 } } });
    }
    if (route_ === "POST /products") {
      // The first try reuses a SKU of another Product.
      if (attempts++ === 0) {
        return route.fulfill({ status: 409, contentType: "application/problem+json", body: JSON.stringify({ status: 409, code: "CATALOG_SKU_TAKEN" }) });
      }
      return route.fulfill({ status: 201, json: created, headers: { ETag: '"v0"' } });
    }
    if (route_ === `GET /products/${created.productId}`) return route.fulfill({ json: created, headers: { ETag: '"v0"' } });
    return route.fulfill({ status: 404, json: { status: 404, code: "NOT_FOUND" } });
  });
}

async function shot(page: Page, name: string) {
  if (process.env.SHOTS_DIR) await page.screenshot({ path: `${process.env.SHOTS_DIR}/${name}.png`, fullPage: true });
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await mockApi(page);
});

test("Owner filters the Products, then creates one with two sizes", async ({ page }) => {
  await page.goto("/admin/products");
  await expect(page.getByRole("heading", { level: 1, name: "Món" })).toBeVisible();
  await expect(page.getByText("6 món", { exact: true })).toBeVisible();
  await expect(page.getByRole("row", { name: /Matcha Latte/ })).toContainText("Matcha latte");
  await shot(page, "21-products");

  await page.getByRole("button", { name: "Nháp" }).click();
  await expect(page).toHaveURL(/status=DRAFT/);
  await expect(page.getByText("1 món", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Tạo món" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Tạo món" })).toBeVisible();
  await page.getByLabel("Tên món").fill("Matcha Đá Xay Dừa");
  await expect(page.getByLabel("Đường dẫn trên menu (slug)")).toHaveValue("matcha-da-xay-dua");
  await page.getByLabel("Mã món").fill("matcha-dx-dua");
  await page.getByLabel("Danh mục chính").selectOption({ label: "— Matcha đá xay" });
  await page.getByLabel("Mô tả ngắn").fill("Matcha Uji xay đá với nước cốt dừa.");
  await page.getByLabel("Mã SKU size 1").fill("MATCHA-DX-DUA-M");
  await page.getByLabel("Tên size 1").fill("M");
  await page.getByLabel("Giá gốc size 1 (đồng)").fill("55000");
  await page.getByRole("button", { name: "Thêm size" }).click();
  await expect(page.getByLabel("Mã SKU size 2")).toBeFocused();
  await page.getByLabel("Mã SKU size 2").fill("MATCHA-LATTE-L");
  await page.getByLabel("Tên size 2").fill("L");
  await page.getByLabel("Giá gốc size 2 (đồng)").fill("65000");
  await page.getByLabel("Giá gốc size 2 (đồng)").blur();

  await page.getByRole("button", { name: "Tạo món" }).click();
  await expect(page.getByRole("alert")).toContainText("Một mã SKU đã được dùng");
  await expect(page.getByLabel("Mã SKU size 1")).toBeFocused();
  await shot(page, "22-sku-taken");

  await page.getByLabel("Mã SKU size 2").fill("MATCHA-DX-DUA-L");
  await page.getByRole("button", { name: "Tạo món" }).click();
  await expect(page).toHaveURL(/\/admin\/products\/matcha-dx-dua$/);
  await expect(page.getByRole("heading", { level: 1, name: "Matcha Đá Xay Dừa" })).toBeVisible();
  await expect(page.getByText("Đã tạo món ở trạng thái Nháp.")).toBeVisible();
  await shot(page, "22-created");
});
