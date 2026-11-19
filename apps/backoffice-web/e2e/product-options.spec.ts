import { type Page, expect, test } from "@playwright/test";

/**
 * Product tab "Tuỳ chọn" (D3d screen 24, FE #48) happy path against a mocked API (no backend): the
 * W4 warning of the mockup, fixed by lowering max, a group attached and moved, then saved.
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

const stamp = { status: "ACTIVE", createdAt: "2026-11-01T03:00:00Z", updatedAt: "2026-11-01T03:00:00Z", version: 3 };
const item = (optionItemId: string, name: string, defaultExtraPrice: number, sortOrder: number, isDefaultSelected = false) => ({
  optionItemId,
  code: optionItemId.toUpperCase(),
  name,
  defaultExtraPrice,
  isDefaultSelected,
  status: "ACTIVE",
  sortOrder,
});
const group = (optionGroupId: string, name: string, selectionType: string, minSelect: number, maxSelect: number, items: unknown[]) => ({
  ...stamp,
  optionGroupId,
  code: optionGroupId.toUpperCase(),
  name,
  selectionType,
  minSelect,
  maxSelect,
  items,
});
const library = [
  group("sugar", "Mức đường", "SINGLE", 1, 1, [
    item("s100", "100%", 0, 1, true),
    item("s70", "70%", 0, 2),
    item("s50", "50%", 0, 3),
    item("s30", "30%", 0, 4),
    item("s0", "Không đường", 0, 5),
  ]),
  group("ice", "Lượng đá", "SINGLE", 1, 1, [item("ice-n", "Đá bình thường", 0, 1, true), item("ice-l", "Ít đá", 0, 2), item("ice-0", "Không đá", 0, 3)]),
  group("topping", "Topping", "MULTIPLE", 0, 5, [
    item("pearl", "Trân châu hoàng kim", 10000, 1),
    item("jelly", "Thạch matcha", 8000, 2),
    item("cheese", "Kem cheese", 12000, 3),
  ]),
  group("milk", "Loại sữa", "SINGLE", 1, 1, [item("milk-f", "Sữa tươi", 0, 1, true), item("milk-o", "Sữa yến mạch", 10000, 2)]),
  group("shot", "Thêm shot espresso", "MULTIPLE", 0, 2, [item("shot-1", "1 shot", 15000, 1)]),
];

const attached = (g: (typeof library)[number], sortOrder: number, maxSelectOverride: number | null = null) => ({
  optionGroupId: g.optionGroupId,
  code: g.code,
  name: g.name,
  selectionType: g.selectionType,
  minSelect: g.minSelect,
  maxSelect: maxSelectOverride ?? g.maxSelect,
  minSelectOverride: null,
  maxSelectOverride,
  sortOrder,
});

type Product = Record<string, unknown> & { version: number };
let product: Product;

function initial(): Product {
  return {
    productId: "matcha-dx-km",
    productCode: "MATCHA-DX-KEMMUOI",
    slug: "matcha-da-xay-kem-muoi",
    name: "Matcha Đá Xay Kem Muối",
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
    variants: [{ variantId: "v-m", sku: "MATCHA-DX-KM-M", name: "M", basePrice: 55000, isDefault: true, status: "ACTIVE", sortOrder: 0 }],
    optionGroups: [attached(library[0]!, 0), attached(library[1]!, 1), attached(library[2]!, 2, 3)],
    optionItemOverrides: [{ optionItemId: "cheese", extraPriceOverride: null, isHidden: true }],
    images: [],
  };
}

async function mockApi(page: Page) {
  product = initial();
  await page.route("**/api/backoffice/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/.*\/api\/backoffice\/v1/, "");
    const key = `${request.method()} ${path}`;
    const answer = (next: Partial<Product>) => {
      product = { ...product, ...next, version: product.version + 1 };
      return route.fulfill({ json: product, headers: { ETag: `"v${product.version}"` } });
    };
    if (key === "GET /auth/me") return route.fulfill({ json: me });
    if (key === "GET /branches") return route.fulfill({ json: { items: [] } });
    if (key === "GET /categories") return route.fulfill({ json: { items: [] } });
    if (key === "GET /option-groups") return route.fulfill({ json: { items: library } });
    if (key === "GET /products/matcha-dx-km") return route.fulfill({ json: product, headers: { ETag: `"v${product.version}"` } });
    if (key === "PUT /products/matcha-dx-km/option-groups") {
      const groups = (request.postDataJSON() as { groups: { optionGroupId: string; maxSelectOverride: number | null }[] }).groups;
      return answer({
        optionGroups: groups.map((g, i) => attached(library.find((l) => l.optionGroupId === g.optionGroupId)!, i, g.maxSelectOverride)),
      });
    }
    if (key === "PUT /products/matcha-dx-km/option-item-overrides") {
      return answer({ optionItemOverrides: (request.postDataJSON() as { overrides: unknown[] }).overrides });
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

test("Owner fixes a group's max, attaches a group, orders it and saves the options", async ({ page }) => {
  await page.goto("/admin/products/matcha-dx-km");
  await page.getByRole("link", { name: "Tuỳ chọn 3 nhóm" }).click();
  const topping = page.getByRole("region", { name: "Topping", exact: true });
  await expect(topping).toContainText("Tối đa 3 lớn hơn số lựa chọn đang hiện (2).");
  await shot(page, "24-options-warning");

  await topping.getByLabel("Chọn tối đa Topping ở món này").fill("2");
  await expect(topping).not.toContainText("lớn hơn số lựa chọn đang hiện");
  await topping.getByLabel("Giá thêm Thạch matcha ở món này (đồng)").fill("9000");
  await page.getByLabel("Gắn nhóm tuỳ chọn").selectOption({ label: "Loại sữa" });
  await page.getByRole("button", { name: "Gắn" }).click();
  await expect(page.getByRole("heading", { level: 3, name: "Loại sữa" })).toBeFocused();
  await page.getByRole("button", { name: "Chuyển Loại sữa lên" }).click();
  await page.getByRole("button", { name: "Lưu tuỳ chọn" }).click();

  await expect(page.getByText("Đã lưu tuỳ chọn của món.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Tuỳ chọn 4 nhóm" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 3 })).toHaveText(["Mức đường", "Lượng đá", "Loại sữa", "Topping"]);
  await shot(page, "24-options-saved");
});
