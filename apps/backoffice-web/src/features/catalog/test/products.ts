import { json } from "../../../test/fake-api";
import type { Product, ProductPage, ProductSummary } from "../api/products";

export function aProductSummary(overrides: Partial<ProductSummary> = {}): ProductSummary {
  return {
    productId: "p-latte",
    productCode: "MATCHA-LATTE",
    slug: "matcha-latte",
    name: "Matcha Latte",
    productType: "STANDARD",
    status: "ACTIVE",
    primaryCategoryId: "c-tea-lychee",
    fromPrice: 45000,
    variantCount: 2,
    updatedAt: "2026-11-04T03:00:00Z",
    version: 3,
    ...overrides,
  };
}

export function aPage(items: ProductSummary[], page: Partial<ProductPage["page"]> = {}): ProductPage {
  return {
    items,
    page: { number: 0, size: 20, totalItems: items.length, totalPages: items.length > 0 ? 1 : 0, ...page },
  };
}

export function aProduct(overrides: Partial<Product> = {}): Product {
  return {
    productId: "p-new",
    productCode: "MATCHA-DX",
    slug: "matcha-da-xay",
    name: "Matcha Đá Xay",
    productType: "STANDARD",
    status: "DRAFT",
    primaryCategoryId: "c-tea",
    shortDescription: null,
    description: null,
    sortOrder: 0,
    archivedAt: null,
    createdAt: "2026-11-18T03:00:00Z",
    updatedAt: "2026-11-18T03:00:00Z",
    version: 0,
    variants: [
      { variantId: "v-m", sku: "MATCHA-DX-M", name: "M", basePrice: 55000, isDefault: false, status: "ACTIVE", sortOrder: 0 },
      { variantId: "v-l", sku: "MATCHA-DX-L", name: "L", basePrice: 65000, isDefault: true, status: "ACTIVE", sortOrder: 1 },
    ],
    optionGroups: [],
    optionItemOverrides: [],
    ...overrides,
  };
}

/** A Product response with its `ETag` and `Location` (API README §8). */
export function productResponse(product: Product, status = 200) {
  const response = json(product, status);
  response.headers.set("ETag", `"v${product.version}"`);
  if (status === 201) response.headers.set("Location", `/api/backoffice/v1/products/${product.productId}`);
  return response;
}
