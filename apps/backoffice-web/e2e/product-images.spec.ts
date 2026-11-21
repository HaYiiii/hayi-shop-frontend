import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { type Page, expect, test } from "@playwright/test";

/**
 * Product tab "Ảnh" (D3d screen 25, FE #49) happy path against a mocked API and storage (no backend): a HEIC is
 * refused, a WebP is uploaded (intent → PUT to storage → finalize → attach), set as primary and moved first.
 * Set SHOTS_DIR to save the screenshots used in the PR.
 */

const webp = readFileSync(fileURLToPath(new URL("../public/logo.webp", import.meta.url)));

const me = {
  userId: "u-o",
  email: "owner@hayi.vn",
  displayName: "Ngọc Hà",
  mfaEnrolled: true,
  storeRoles: ["OWNER"],
  storePermissions: ["BRANCH_VIEW", "BRANCH_MANAGE", "STAFF_VIEW", "CATALOG_VIEW", "CATALOG_MANAGE", "CATALOG_PRICE_MANAGE"],
  branches: [],
};

type Image = { imageId: string; storedObjectId: string; url: string; altText: string | null; sortOrder: number; isPrimary: boolean };
type Product = Record<string, unknown> & { version: number; images: Image[] };
let product: Product;

function initial(): Product {
  return {
    productId: "latte",
    productCode: "MATCHA-LATTE",
    slug: "matcha-latte",
    name: "Matcha Latte",
    productType: "STANDARD",
    status: "ACTIVE",
    primaryCategoryId: null,
    shortDescription: null,
    description: null,
    sortOrder: 0,
    archivedAt: null,
    createdAt: "2026-11-05T03:00:00Z",
    updatedAt: "2026-11-05T03:00:00Z",
    version: 4,
    variants: [{ variantId: "v-m", sku: "MATCHA-LATTE-M", name: "M", basePrice: 45000, isDefault: true, status: "ACTIVE", sortOrder: 0 }],
    optionGroups: [],
    optionItemOverrides: [],
    images: [
      { imageId: "hero", storedObjectId: "o-hero", url: "https://cdn.hayi.test/hero.webp", altText: "Ly Matcha Latte nhìn nghiêng", sortOrder: 0, isPrimary: true },
    ],
    sellingSchedules: [],
    tags: [],
  };
}

async function mockApi(page: Page) {
  product = initial();
  await page.route("https://cdn.hayi.test/**", (route) => route.fulfill({ body: webp, contentType: "image/webp" }));
  // The browser's PUT to the pre-signed URL; slowed a little so the progress tile can be seen.
  await page.route("https://storage.hayi.test/**", async (route) => {
    await new Promise((r) => setTimeout(r, 400));
    await route.fulfill({ status: 200, body: "" });
  });
  await page.route("**/api/backoffice/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/.*\/api\/backoffice\/v1/, "");
    const key = `${request.method()} ${path}`;
    const answer = (next: Partial<Product>, status = 200) => {
      product = { ...product, ...next, version: product.version + 1 };
      return route.fulfill({ status, json: product, headers: { ETag: `"v${product.version}"` } });
    };
    if (key === "GET /auth/me") return route.fulfill({ json: me });
    if (key === "GET /branches") return route.fulfill({ json: { items: [] } });
    if (key === "GET /categories") return route.fulfill({ json: { items: [] } });
    if (key === "GET /products/latte") return route.fulfill({ json: product, headers: { ETag: `"v${product.version}"` } });
    if (key === "POST /uploads") {
      const body = request.postDataJSON() as { contentType: string };
      return route.fulfill({
        status: 201,
        json: {
          storedObjectId: "o-top",
          upload: { method: "PUT", url: "https://storage.hayi.test/put?sig=1", headers: { "Content-Type": body.contentType }, expiresAt: "2026-11-21T03:10:00Z" },
          constraints: { maxSizeBytes: 5242880, allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"] },
        },
      });
    }
    if (key === "POST /uploads/o-top/finalize") {
      return route.fulfill({
        json: { storedObjectId: "o-top", status: "ACTIVE", detectedMimeType: "image/webp", sizeBytes: webp.length, width: 512, height: 512, publicUrl: "https://cdn.hayi.test/top.webp" },
      });
    }
    if (key === "POST /products/latte/images") {
      return answer(
        { images: [...product.images, { imageId: "top", storedObjectId: "o-top", url: "https://cdn.hayi.test/top.webp", altText: null, sortOrder: 1, isPrimary: false }] },
        201,
      );
    }
    if (key === "PATCH /products/latte/images/top") {
      const patch = request.postDataJSON() as { altText?: string | null; isPrimary?: true };
      return answer({
        images: product.images.map((i) =>
          i.imageId === "top" ? { ...i, ...patch, isPrimary: patch.isPrimary ?? i.isPrimary } : patch.isPrimary ? { ...i, isPrimary: false } : i,
        ),
      });
    }
    if (key === "PUT /products/latte/images/order") {
      const ids = (request.postDataJSON() as { imageIds: string[] }).imageIds;
      return answer({ images: product.images.map((i) => ({ ...i, sortOrder: ids.indexOf(i.imageId) })) });
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

test("Owner uploads a product image, makes it primary and moves it first", async ({ page }) => {
  await page.goto("/admin/products/latte");
  await page.getByRole("link", { name: "Ảnh 1" }).click();
  const picker = page.getByLabel(/Kéo ảnh vào đây hoặc chọn từ máy/);

  await picker.setInputFiles({ name: "matcha-latte-hero.heic", mimeType: "image/heic", buffer: Buffer.from("heic") });
  await expect(page.getByRole("alert")).toContainText("Chưa tải được “matcha-latte-hero.heic”");

  await picker.setInputFiles({ name: "matcha-latte-top.webp", mimeType: "image/webp", buffer: webp });
  await expect(page.getByRole("progressbar", { name: "Đang tải matcha-latte-top.webp" })).toBeVisible();
  await shot(page, "25-uploading");
  await expect(page.getByRole("article", { name: "Ảnh 2" })).toBeVisible();

  const second = page.getByRole("article", { name: "Ảnh 2" });
  await second.getByLabel("Mô tả ảnh").fill("Matcha được đánh bằng chổi tre");
  await second.getByLabel("Mô tả ảnh").blur();
  await expect(page.getByText("Đã lưu mô tả ảnh.")).toBeVisible();
  await second.getByRole("button", { name: "Đặt làm ảnh chính" }).click();
  await expect(page.getByText("Đã đặt làm ảnh chính.")).toBeVisible();
  await page.getByRole("button", { name: "Chuyển ảnh 2 sang trái" }).click();
  await expect(page.getByRole("article", { name: "Ảnh 1" })).toContainText("Ảnh chính");
  await expect(page.getByRole("article", { name: "Ảnh 1" }).getByLabel("Mô tả ảnh")).toHaveValue("Matcha được đánh bằng chổi tre");
  await shot(page, "25-images");
});
