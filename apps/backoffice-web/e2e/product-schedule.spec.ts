import { type Page, expect, test } from "@playwright/test";

/**
 * Product tab "Lịch bán & tag" (D3d screen 26, FE #54) happy path against a mocked API (no backend): a period
 * with two windows is saved; an overlap is shown at its row first. Set SHOTS_DIR to save PR screenshots.
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

type Product = Record<string, unknown> & { version: number };
let product: Product;

function initial(): Product {
  return {
    productId: "latte-nong",
    productCode: "MATCHA-LATTE-NONG",
    slug: "matcha-latte-nong",
    name: "Matcha Latte Nóng",
    productType: "STANDARD",
    status: "ACTIVE",
    primaryCategoryId: null,
    shortDescription: null,
    description: null,
    sortOrder: 0,
    archivedAt: null,
    createdAt: "2026-11-05T03:00:00Z",
    updatedAt: "2026-11-05T03:00:00Z",
    version: 6,
    variants: [{ variantId: "v-m", sku: "LATTE-NONG-M", name: "M", basePrice: 55000, isDefault: true, status: "ACTIVE", sortOrder: 0 }],
    optionGroups: [],
    optionItemOverrides: [],
    images: [],
    sellingSchedules: [],
    tags: [],
  };
}

async function mockApi(page: Page) {
  product = initial();
  await page.route("**/api/backoffice/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/.*\/api\/backoffice\/v1/, "");
    const key = `${request.method()} ${path}`;
    if (key === "GET /auth/me") return route.fulfill({ json: me });
    if (key === "GET /branches") return route.fulfill({ json: { items: [] } });
    if (key === "GET /categories") return route.fulfill({ json: { items: [] } });
    if (key === "GET /products/latte-nong") return route.fulfill({ json: product, headers: { ETag: `"v${product.version}"` } });
    if (key === "PUT /products/latte-nong/selling-schedules") {
      const body = request.postDataJSON() as { schedules: unknown[] };
      product = { ...product, sellingSchedules: body.schedules, version: product.version + 1 };
      return route.fulfill({ json: product, headers: { ETag: `"v${product.version}"` } });
    }
    return route.fulfill({ status: 404, json: { status: 404, code: "NOT_FOUND" } });
  });
}

async function shot(page: Page, name: string) {
  if (!process.env.SHOTS_DIR) return;
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${process.env.SHOTS_DIR}/${name}.png`, fullPage: true });
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await mockApi(page);
});

test("Owner sets a selling period with two windows", async ({ page }) => {
  await page.goto("/admin/products/latte-nong");
  await page.getByRole("link", { name: "Lịch bán & tag" }).click();
  await expect(page.getByText("Món đang bán mọi lúc chi nhánh nhận đơn.")).toBeVisible();

  await page.getByRole("button", { name: "Thêm đợt bán" }).click();
  await page.getByLabel("Từ ngày").fill("2026-12-01");
  await page.getByLabel("Đến ngày").fill("2026-12-31");
  await page.getByLabel("Đợt 1 khung 1 bắt đầu").fill("07:00");
  await page.getByLabel("Đợt 1 khung 1 kết thúc").fill("11:00");
  await page.getByRole("button", { name: "Thêm khung" }).click();
  await page.getByLabel("Đợt 1 khung 2 áp dụng").selectOption({ label: "Thứ 7" });
  await page.getByLabel("Đợt 1 khung 2 bắt đầu").fill("10:00");
  await page.getByLabel("Đợt 1 khung 2 kết thúc").fill("14:00");
  await page.getByRole("button", { name: "Lưu lịch bán" }).click();
  await expect(page.getByRole("alert")).toContainText("Đợt 1 khung 2: Khung này trùng giờ");
  await shot(page, "26-schedule-overlap");

  await page.getByLabel("Đợt 1 khung 2 bắt đầu").fill("13:00");
  await page.getByLabel("Đợt 1 khung 2 kết thúc").fill("17:00");
  await page.getByRole("button", { name: "Lưu lịch bán" }).click();
  await expect(page.getByText(/Đã lưu lịch bán/)).toBeVisible();
  await shot(page, "26-schedule");
});
