import { type Page, expect, test } from "@playwright/test";

/**
 * Collections & tags (D3d screen 28) and the product's tags (screen 26), FE #53, against a mocked API (no backend):
 * reorder and add products in a Collection, add a tag, then tag a product. Set SHOTS_DIR to save PR screenshots.
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

const at = "2026-11-01T03:00:00Z";
type Collection = { collectionId: string; slug: string; name: string; description: null; status: string; sortOrder: number; productIds: string[]; version: number; createdAt: string; updatedAt: string };
type Tag = { tagId: string; slug: string; name: string; createdAt: string };

const collection = (collectionId: string, name: string, sortOrder: number, productIds: string[]): Collection => ({
  collectionId,
  slug: collectionId,
  name,
  description: null,
  status: "ACTIVE",
  sortOrder,
  productIds,
  version: 2,
  createdAt: at,
  updatedAt: at,
});
const tag = (tagId: string, name: string): Tag => ({ tagId, slug: tagId, name, createdAt: at });

const summary = (productId: string, productCode: string, name: string) => ({
  productId,
  productCode,
  slug: productId,
  name,
  productType: "STANDARD",
  status: "ACTIVE",
  primaryCategoryId: null,
  variantCount: 1,
  fromPrice: 55000,
  updatedAt: at,
  version: 1,
});
const products = [
  summary("latte-nong", "MATCHA-LATTE-NONG", "Matcha Latte Nóng"),
  summary("bido", "MATCHA-BIDO", "Matcha Bí Đỏ"),
  summary("hatde", "HOJICHA-HATDE", "Hojicha Hạt Dẻ"),
];

type Product = Record<string, unknown> & { version: number; tags: Tag[] };
const productDetail = (): Product => ({
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
  createdAt: at,
  updatedAt: at,
  version: 6,
  variants: [{ variantId: "v-m", sku: "LATTE-NONG-M", name: "M", basePrice: 55000, isDefault: true, status: "ACTIVE", sortOrder: 0 }],
  optionGroups: [],
  optionItemOverrides: [],
  images: [],
  sellingSchedules: [],
  tags: [],
});

async function mockApi(page: Page) {
  let collections = [collection("mua-thu", "Mùa thu 2026", 0, ["bido", "hatde"]), collection("ban-chay", "Bán chạy", 1, ["latte-nong"])];
  let tags = [tag("it-ngot", "Ít ngọt"), tag("nong", "Uống nóng")];
  let product = productDetail();
  const update = (id: string, change: Partial<Collection>) => {
    const old = collections.find((c) => c.collectionId === id)!;
    const next = { ...old, ...change, version: old.version + 1 };
    collections = collections.map((c) => (c.collectionId === id ? next : c)).sort((a, b) => a.sortOrder - b.sortOrder);
    return next;
  };
  await page.route("**/api/backoffice/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/.*\/api\/backoffice\/v1/, "");
    const key = `${request.method()} ${path}`;
    const etag = (v: number) => ({ ETag: `"v${v}"` });
    if (key === "GET /auth/me") return route.fulfill({ json: me });
    if (key === "GET /branches") return route.fulfill({ json: { items: [] } });
    if (key === "GET /categories") return route.fulfill({ json: { items: [] } });
    if (key === "GET /collections") return route.fulfill({ json: { items: collections } });
    if (key === "GET /tags") return route.fulfill({ json: { items: tags } });
    if (key === "GET /products") return route.fulfill({ json: { items: products, page: { number: 0, size: 100, totalItems: products.length, totalPages: 1 } } });
    const patch = /^(PATCH|PUT) \/collections\/([^/]+)(\/products)?$/.exec(key);
    if (patch) {
      const next = update(patch[2]!, request.postDataJSON() as Partial<Collection>);
      return route.fulfill({ json: next, headers: etag(next.version) });
    }
    if (key === "POST /tags") {
      const body = request.postDataJSON() as { name: string; slug: string };
      tags = [...tags, tag(body.slug, body.name)];
      return route.fulfill({ status: 201, json: tags.at(-1) });
    }
    if (key === "GET /products/latte-nong") return route.fulfill({ json: product, headers: etag(product.version) });
    if (key === "PUT /products/latte-nong/tags") {
      const body = request.postDataJSON() as { tagIds: string[] };
      product = { ...product, tags: body.tagIds.map((id) => tags.find((t) => t.tagId === id)!), version: product.version + 1 };
      return route.fulfill({ json: product, headers: etag(product.version) });
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

test("Owner orders a Collection's products, adds a tag and tags a product", async ({ page }) => {
  await page.goto("/admin/collections");
  await expect(page.getByRole("heading", { level: 1, name: "Bộ sưu tập & tag" })).toBeVisible();
  const editor = page.getByRole("region", { name: "Mùa thu 2026" });
  await expect(editor.getByText("Hojicha Hạt Dẻ")).toBeVisible();

  await editor.getByRole("button", { name: "Chuyển Hojicha Hạt Dẻ lên" }).click();
  await editor.getByLabel("Thêm món vào bộ sưu tập").selectOption({ label: "Matcha Latte Nóng · MATCHA-LATTE-NONG" });
  await editor.getByRole("button", { name: "Thêm" }).click();
  await editor.getByRole("button", { name: "Lưu bộ sưu tập" }).click();
  await expect(page.getByText(/Đã lưu bộ sưu tập/)).toBeVisible();

  const tagsCard = page.getByRole("region", { name: "Tag" });
  await tagsCard.getByLabel("Tag mới").fill("Mùa thu");
  await expect(tagsCard.getByLabel("Đường dẫn tag")).toHaveValue("mua-thu");
  await tagsCard.getByRole("button", { name: "Thêm" }).click();
  await expect(tagsCard.getByText("Đã thêm tag.")).toBeVisible();
  await shot(page, "28-collections");

  await page.goto("/admin/products/latte-nong");
  await page.getByRole("link", { name: "Lịch bán & tag" }).click();
  const productTags = page.getByRole("region", { name: "Tag" });
  await expect(productTags.getByText("Món chưa có tag.")).toBeVisible();
  await productTags.getByLabel("Thêm tag").selectOption({ label: "Uống nóng" });
  await productTags.getByRole("button", { name: "Thêm" }).click();
  await productTags.getByLabel("Thêm tag").selectOption({ label: "Mùa thu" });
  await productTags.getByRole("button", { name: "Thêm" }).click();
  await productTags.getByRole("button", { name: "Lưu tag" }).click();
  await expect(page.getByText("Đã lưu tag của món.")).toBeVisible();
  await expect(productTags.getByRole("list", { name: "Tag của món" })).toContainText("Uống nóng");
  await shot(page, "26-tags");
});
