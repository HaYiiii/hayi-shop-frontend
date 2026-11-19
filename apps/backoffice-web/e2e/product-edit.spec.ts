import { type Page, expect, test } from "@playwright/test";

/**
 * Product page (D3d screen 23, FE #47) happy path against a mocked API (no backend): activation
 * blocked by an archived primary Category, fix it in tab "Thông tin & size", save, activate.
 * Set SHOTS_DIR to save the screenshots used in the PR.
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
const cat = (categoryId: string, name: string, parentId: string | null, sortOrder: number, status = "ACTIVE") => ({
  ...stamp,
  status,
  categoryId,
  name,
  slug: categoryId,
  parentId,
  sortOrder,
});
const tree = [
  {
    ...cat("matcha", "Matcha", null, 1),
    children: [cat("m-latte", "Matcha latte", "matcha", 1), cat("m-ice", "Matcha đá xay", "matcha", 2, "ARCHIVED")],
  },
  { ...cat("milk-tea", "Trà sữa", null, 2), children: [] },
];

type Product = Record<string, unknown> & { version: number; status: string; variants: Record<string, unknown>[] };

let product: Product;

function initial(): Product {
  return {
    productId: "matcha-dx-km",
    productCode: "MATCHA-DX-KEMMUOI",
    slug: "matcha-da-xay-kem-muoi",
    name: "Matcha Đá Xay Kem Muối",
    productType: "STANDARD",
    status: "DRAFT",
    primaryCategoryId: "m-ice",
    shortDescription: "Matcha xay đá, phủ kem muối.",
    description: "Bột matcha Uji đánh tay, xay cùng đá và sữa tươi. Lớp kem muối phủ trên giữ vị mặn nhẹ đến ngụm cuối.",
    sortOrder: 0,
    archivedAt: null,
    createdAt: "2026-11-05T03:00:00Z",
    updatedAt: "2026-11-05T03:00:00Z",
    version: 4,
    variants: [
      { variantId: "v-m", sku: "MATCHA-DX-KM-M", name: "M", basePrice: 55000, isDefault: true, status: "ACTIVE", sortOrder: 0 },
      { variantId: "v-l", sku: "MATCHA-DX-KM-L", name: "L", basePrice: 65000, isDefault: false, status: "ACTIVE", sortOrder: 1 },
    ],
    optionGroups: [],
    optionItemOverrides: [],
    images: [],
    sellingSchedules: [],
  };
}

async function mockApi(page: Page) {
  product = initial();
  await page.route("**/api/backoffice/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/.*\/api\/backoffice\/v1/, "");
    const key = `${request.method()} ${path}`;
    const answer = (next: Partial<Product>) => {
      product = { ...product, ...next, version: product.version + 1, updatedAt: "2026-11-19T03:00:00Z" };
      return route.fulfill({ json: product, headers: { ETag: `"v${product.version}"` } });
    };
    if (key === "GET /auth/me") return route.fulfill({ json: me });
    if (key === "GET /branches") return route.fulfill({ json: { items: [] } });
    if (key === "GET /categories") return route.fulfill({ json: { items: tree } });
    if (key === "GET /products/matcha-dx-km") return route.fulfill({ json: product, headers: { ETag: `"v${product.version}"` } });
    if (key === "PATCH /products/matcha-dx-km") return answer(request.postDataJSON() as Partial<Product>);
    if (key === "PATCH /products/matcha-dx-km/variants/v-l") {
      const change = request.postDataJSON() as Record<string, unknown>;
      // `isDefault: true` moves the flag (Decision AE3).
      return answer({
        variants: product.variants.map((v) =>
          v.variantId === "v-l" ? { ...v, ...change } : change.isDefault ? { ...v, isDefault: false } : v,
        ),
      });
    }
    if (key === "POST /products/matcha-dx-km/activate") {
      if (product.primaryCategoryId === "m-ice") {
        return route.fulfill({
          status: 422,
          contentType: "application/problem+json",
          body: JSON.stringify({ status: 422, code: "PRODUCT_ACTIVATION_INVALID", issues: [{ code: "PRIMARY_CATEGORY_INACTIVE" }] }),
        });
      }
      return answer({ status: "ACTIVE" });
    }
    return route.fulfill({ status: 404, json: { status: 404, code: "NOT_FOUND" } });
  });
}

async function shot(page: Page, name: string) {
  if (!process.env.SHOTS_DIR) return;
  // Colour transitions (150 ms) would otherwise show a stale state.
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${process.env.SHOTS_DIR}/${name}.png`, fullPage: true });
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await mockApi(page);
});

test("Owner fixes what blocks activation, saves the Product and activates it", async ({ page }) => {
  await page.goto("/admin/products/matcha-dx-km");
  await expect(page.getByRole("heading", { level: 1, name: "Matcha Đá Xay Kem Muối" })).toBeVisible();
  await expect(page.getByLabel("Danh mục chính")).toHaveValue("m-ice");
  await expect(page.getByText("Danh mục này đã lưu trữ. Chọn danh mục khác.")).toBeVisible();

  await page.getByRole("button", { name: "Kích hoạt" }).click();
  const issues = page.getByRole("alert").filter({ hasText: "Chưa kích hoạt được món này" });
  await expect(issues).toContainText("Danh mục chính “Matcha đá xay” đã lưu trữ.");
  await shot(page, "23-activation-invalid");

  await issues.getByRole("link", { name: "Sửa ngay" }).click();
  await expect(page.getByLabel("Danh mục chính")).toBeFocused();
  await page.getByLabel("Danh mục chính").selectOption({ label: "— Matcha latte" });
  await page.getByLabel("Giá gốc size L (đồng)").fill("69000");
  await page.getByLabel("Giá gốc size L (đồng)").blur();
  await page.getByRole("radio", { name: "Mặc định" }).nth(1).check();
  await page.getByRole("button", { name: "Lưu thông tin" }).click();
  await expect(page.getByText("Đã lưu thông tin món.")).toBeVisible();

  await page.getByRole("button", { name: "Kích hoạt" }).click();
  await expect(page.getByText(/Đã kích hoạt món/)).toBeVisible();
  const header = page.getByRole("region", { name: "Tóm tắt món" });
  await expect(header).toContainText("Đang bán");
  await expect(header.getByRole("button", { name: "Tạm ngưng…" })).toBeVisible();
  await expect(page.getByRole("radio", { name: "Mặc định" }).nth(1)).toBeChecked();
  await shot(page, "23-active");
});
