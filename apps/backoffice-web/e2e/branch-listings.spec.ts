import { type Page, expect, test } from "@playwright/test";

/**
 * Branch listings (D3d screen 29, FE #50) happy path against a mocked API (no backend): a manager sells a
 * draft Product, sets a Branch price for one size and stops selling another Product.
 * Set SHOTS_DIR to save the screenshots used in the PR.
 */

const me = {
  userId: "u-m",
  email: "minh@hayi.vn",
  displayName: "Trần Minh",
  mfaEnrolled: true,
  storeRoles: [],
  storePermissions: [],
  branches: [{ branchId: "q1", roles: ["MANAGER"], permissions: ["BRANCH_VIEW", "CATALOG_VIEW", "BRANCH_LISTING_MANAGE", "FULFILLMENT_CONFIG_MANAGE"] }],
};

const branch = {
  branchId: "q1",
  branchCode: "Q1-LELOI",
  name: "Quận 1 · Lê Lợi",
  status: "ACTIVE",
  timezone: "Asia/Ho_Chi_Minh",
};

type Variant = { variantId: string; name: string; basePrice: number; price: number | null; effectivePrice: number; availabilityState: string };
type Row = { productId: string; productCode: string; name: string; status: string; listing: { availabilityState: string; version: number; variants: Variant[] } | null };

const v = (variantId: string, name: string, basePrice: number, price: number | null = null, availabilityState = "AVAILABLE"): Variant => ({
  variantId,
  name,
  basePrice,
  price,
  effectivePrice: price ?? basePrice,
  availabilityState,
});

let rows: Row[];

function initial(): Row[] {
  return [
    { productId: "bac-xiu", productCode: "BAC-XIU", name: "Bạc Xỉu", status: "ACTIVE", listing: null },
    {
      productId: "hojicha",
      productCode: "HOJICHA-OAT",
      name: "Hojicha Sữa Yến Mạch",
      status: "ACTIVE",
      listing: { availabilityState: "SOLD_OUT", version: 5, variants: [v("h-m", "M", 49000), v("h-l", "L", 59000)] },
    },
    {
      productId: "latte",
      productCode: "MATCHA-LATTE",
      name: "Matcha Latte",
      status: "ACTIVE",
      listing: { availabilityState: "AVAILABLE", version: 3, variants: [v("l-m", "M", 45000, 48000), v("l-l", "L", 55000)] },
    },
    { productId: "dx-km", productCode: "MATCHA-DX-KEMMUOI", name: "Matcha Đá Xay Kem Muối", status: "DRAFT", listing: null },
  ];
}

async function mockApi(page: Page) {
  rows = initial();
  await page.route("**/api/backoffice/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/.*\/api\/backoffice\/v1/, "");
    const key = `${request.method()} ${path}`;
    const answer = (productId: string, change: (row: Row) => Row["listing"]) => {
      const row = rows.find((r) => r.productId === productId)!;
      const listing = change(row)!;
      const next = { ...row, listing: { ...listing, version: (row.listing?.version ?? 0) + 1 } };
      rows = rows.map((r) => (r.productId === productId ? next : r));
      return route.fulfill({ json: next, headers: { ETag: `"v${next.listing.version}"` } });
    };
    if (key === "GET /auth/me") return route.fulfill({ json: me });
    if (key === "GET /branches") return route.fulfill({ json: { items: [branch] } });
    if (key === "GET /branches/q1/listings") {
      return route.fulfill({ json: { items: rows, page: { number: 0, size: 20, totalItems: rows.length, totalPages: 1 } } });
    }
    let m = /^PUT \/branches\/q1\/listings\/([^/]+)$/.exec(key);
    if (m) {
      const state = (request.postDataJSON() as { availabilityState: string }).availabilityState;
      return answer(m[1]!, (row) => ({
        availabilityState: state,
        version: 0,
        variants: row.listing?.variants ?? [v(`${row.productId}-m`, "M", 55000), v(`${row.productId}-l`, "L", 65000)],
      }));
    }
    m = /^PUT \/branches\/q1\/listings\/([^/]+)\/variants\/([^/]+)$/.exec(key);
    if (m) {
      const body = request.postDataJSON() as { price: number | null; availabilityState: string };
      const variantId = m[2]!;
      return answer(m[1]!, (row) => ({
        ...row.listing!,
        variants: row.listing!.variants.map((x) => (x.variantId === variantId ? v(x.variantId, x.name, x.basePrice, body.price, body.availabilityState) : x)),
      }));
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

test("Manager sells a Product, sets a Branch price and stops selling another", async ({ page }) => {
  await page.goto("/branches/q1/listings");
  await expect(page.getByRole("heading", { level: 1, name: "Món bán tại chi nhánh" })).toBeVisible();
  await expect(page.getByRole("row", { name: /Hojicha/ })).toContainText("Hết hàng");

  await page.getByRole("row", { name: /Matcha Đá Xay Kem Muối/ }).getByRole("button", { name: "Bật bán" }).click();
  await expect(page.getByText("Đã bật bán Matcha Đá Xay Kem Muối tại Quận 1 · Lê Lợi.")).toBeVisible();

  await page.getByRole("button", { name: "Mở rộng Matcha Latte" }).click();
  await page.getByLabel("Giá size L tại chi nhánh (đồng)").fill("57000");
  await page.getByLabel("Giá size L tại chi nhánh (đồng)").blur();
  await page.getByRole("button", { name: "Lưu giá" }).click();
  await expect(page.getByText(/Đã lưu giá của Matcha Latte tại Quận 1 · Lê Lợi/)).toBeVisible();
  await shot(page, "29-listings");

  await page.getByRole("row", { name: /Bạc Xỉu/ }).getByRole("button", { name: "Bật bán" }).click();
  await expect(page.getByRole("row", { name: /Bạc Xỉu/ })).toContainText("Đang bán");
  await page.getByRole("row", { name: /Bạc Xỉu/ }).getByRole("button", { name: "Gỡ bán" }).click();
  await expect(page.getByRole("row", { name: /Bạc Xỉu/ })).toContainText("Chưa bán");
});
