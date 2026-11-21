import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { type Page, expect, test } from "@playwright/test";

/** Category image (FE #49, D2 form pattern with screen 25's upload) against a mocked API and storage. */

const webp = readFileSync(fileURLToPath(new URL("../public/logo.webp", import.meta.url)));

const me = {
  userId: "u-o",
  email: "owner@hayi.vn",
  displayName: "Ngọc Hà",
  mfaEnrolled: true,
  storeRoles: ["OWNER"],
  storePermissions: ["BRANCH_VIEW", "BRANCH_MANAGE", "STAFF_VIEW", "CATALOG_VIEW", "CATALOG_MANAGE"],
  branches: [],
};

let image: { imageObjectId: string | null; imageUrl: string | null; version: number };

const category = () => ({
  categoryId: "matcha",
  name: "Matcha",
  slug: "matcha",
  description: null,
  parentId: null,
  sortOrder: 1,
  status: "ACTIVE",
  createdAt: "2026-11-01T03:00:00Z",
  updatedAt: "2026-11-01T03:00:00Z",
  ...image,
});

async function mockApi(page: Page) {
  image = { imageObjectId: null, imageUrl: null, version: 2 };
  await page.route("https://cdn.hayi.test/**", (route) => route.fulfill({ body: webp, contentType: "image/webp" }));
  await page.route("https://storage.hayi.test/**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.route("**/api/backoffice/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/.*\/api\/backoffice\/v1/, "");
    const key = `${request.method()} ${path}`;
    if (key === "GET /auth/me") return route.fulfill({ json: me });
    if (key === "GET /branches") return route.fulfill({ json: { items: [] } });
    if (key === "GET /categories") return route.fulfill({ json: { items: [{ ...category(), children: [] }] } });
    if (key === "POST /uploads") {
      return route.fulfill({
        status: 201,
        json: {
          storedObjectId: "o-cat",
          upload: { method: "PUT", url: "https://storage.hayi.test/put", headers: { "Content-Type": "image/webp" }, expiresAt: "2026-11-21T03:10:00Z" },
          constraints: { maxSizeBytes: 5242880, allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"] },
        },
      });
    }
    if (key === "POST /uploads/o-cat/finalize") {
      return route.fulfill({
        json: { storedObjectId: "o-cat", status: "ACTIVE", detectedMimeType: "image/webp", sizeBytes: webp.length, width: 512, height: 512, publicUrl: "https://cdn.hayi.test/cat.webp" },
      });
    }
    if (key === "PATCH /categories/matcha") {
      image = { imageObjectId: "o-cat", imageUrl: "https://cdn.hayi.test/cat.webp", version: image.version + 1 };
      return route.fulfill({ json: category(), headers: { ETag: `"v${image.version}"` } });
    }
    return route.fulfill({ status: 404, json: { status: 404, code: "NOT_FOUND" } });
  });
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await mockApi(page);
});

test("Owner adds an image to a Category", async ({ page }) => {
  await page.goto("/admin/categories");
  await page.getByRole("button", { name: "Sửa Matcha" }).click();
  await page.getByLabel(/Kéo ảnh vào đây hoặc chọn từ máy/).setInputFiles({ name: "matcha.webp", mimeType: "image/webp", buffer: webp });
  await expect(page.getByText("Đã lưu ảnh danh mục.")).toBeVisible();
  await expect(page.getByRole("img", { name: "Matcha" })).toBeVisible();
  if (process.env.SHOTS_DIR) {
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${process.env.SHOTS_DIR}/20-category-image.png`, fullPage: true });
  }
});
