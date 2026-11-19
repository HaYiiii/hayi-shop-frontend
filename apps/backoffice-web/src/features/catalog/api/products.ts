import type { BackofficeComponents } from "@hayi/api-client";
import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import { type BackofficeClient, unwrap } from "../../../lib/api";

type Schemas = BackofficeComponents["schemas"];
export type Product = Schemas["Product"];
export type ProductSummary = Schemas["ProductSummary"];
export type ProductPage = Schemas["ProductPage"];
export type ProductStatus = Schemas["ProductStatus"];
export type ProductCreateRequest = Schemas["ProductCreateRequest"];

export const PAGE_SIZE = 20;

/** Filters of `GET /products` (API 08 §1.3); `page` is 0-based like the API. */
export interface ProductFilters {
  status?: ProductStatus | undefined;
  categoryId?: string | undefined;
  q?: string | undefined;
  page?: number | undefined;
}

export const productKeys = {
  all: ["products"] as const,
  list: (filters: ProductFilters) => [...productKeys.all, "list", filters] as const,
  detail: (productId: string) => [...productKeys.all, "detail", productId] as const,
};

/** One page sorted by name; the previous page stays on screen while the next one loads. */
export function productsQuery(api: BackofficeClient, filters: ProductFilters) {
  const { status, categoryId, q, page } = filters;
  return queryOptions({
    queryKey: productKeys.list(filters),
    queryFn: () =>
      unwrap(
        api.GET("/products", {
          params: {
            query: {
              size: PAGE_SIZE,
              ...(page && { page }),
              ...(status && { status: [status] }),
              ...(categoryId && { categoryId }),
              ...(q && { q }),
            },
          },
        }),
      ),
    placeholderData: keepPreviousData,
  });
}

export function productQuery(api: BackofficeClient, productId: string) {
  return queryOptions({
    queryKey: productKeys.detail(productId),
    queryFn: () => unwrap(api.GET("/products/{productId}", { params: { path: { productId } } })),
  });
}

/** A DRAFT Product with its Variants; needs `CATALOG_MANAGE` and `CATALOG_PRICE_MANAGE` (Decision Z4). */
export function createProduct(api: BackofficeClient, body: ProductCreateRequest) {
  return unwrap(api.POST("/products", { body }));
}

type ProductPatch = Schemas["ProductPatch"];
type VariantPatch = Schemas["ProductVariantPatch"];
type VariantInput = Schemas["ProductVariantInput"];
export type ProductCommand = "activate" | "deactivate" | "archive";

/** Every write answers the Product with its new version (Decision AE); stale screens get `412`. */
const ifMatch = (version: number) => ({ "If-Match": `"v${version}"` });
const mergePatch = { "Content-Type": "application/merge-patch+json" };

/** Merge Patch of name, slug, category and descriptions; `If-Match` required (API 08 §1.7). */
export function updateProduct(api: BackofficeClient, product: Product, body: ProductPatch, version = product.version) {
  return unwrap(
    api.PATCH("/products/{productId}", {
      params: { path: { productId: product.productId }, header: ifMatch(version) },
      body,
      headers: mergePatch,
    }),
  );
}

/** Adds a size last; needs `CATALOG_PRICE_MANAGE` too. */
export function addVariant(api: BackofficeClient, product: Product, body: VariantInput, version = product.version) {
  return unwrap(
    api.POST("/products/{productId}/variants", {
      params: { path: { productId: product.productId }, header: ifMatch(version) },
      body,
    }),
  );
}

/** Merge Patch of a size; `If-Match` = the Product's version. */
export function updateVariant(api: BackofficeClient, product: Product, variantId: string, body: VariantPatch, version = product.version) {
  return unwrap(
    api.PATCH("/products/{productId}/variants/{variantId}", {
      params: { path: { productId: product.productId, variantId }, header: ifMatch(version) },
      body,
      headers: mergePatch,
    }),
  );
}

/** Final; the default size cannot be archived while another one is left (`409 CATALOG_VARIANT_IS_DEFAULT`). */
export function archiveVariant(api: BackofficeClient, product: Product, variantId: string) {
  return unwrap(
    api.POST("/products/{productId}/variants/{variantId}/archive", {
      params: { path: { productId: product.productId, variantId }, header: ifMatch(product.version) },
    }),
  );
}

/** Replaces the attached option groups, in order (Decision AC2); `If-Match` required. */
export function replaceOptionGroups(api: BackofficeClient, product: Product, body: Schemas["ProductOptionGroupsReplaceRequest"]) {
  return unwrap(
    api.PUT("/products/{productId}/option-groups", {
      params: { path: { productId: product.productId }, header: ifMatch(product.version) },
      body,
    }),
  );
}

/** Replaces the item overrides (Decision AC3); `If-Match` required. */
export function replaceOptionItemOverrides(
  api: BackofficeClient,
  product: Product,
  body: Schemas["ProductOptionItemOverridesReplaceRequest"],
) {
  return unwrap(
    api.PUT("/products/{productId}/option-item-overrides", {
      params: { path: { productId: product.productId }, header: ifMatch(product.version) },
      body,
    }),
  );
}

/**
 * Lifecycle (API 08 §1.4, Decision AA). `If-Match` is optional and left out: the server checks the
 * transition, and an edit of the name meanwhile should not stop an activation.
 */
export function runProductCommand(api: BackofficeClient, product: Product, command: ProductCommand) {
  const params = { path: { productId: product.productId } };
  switch (command) {
    case "activate":
      return unwrap(api.POST("/products/{productId}/activate", { params }));
    case "deactivate":
      return unwrap(api.POST("/products/{productId}/deactivate", { params }));
    case "archive":
      return unwrap(api.POST("/products/{productId}/archive", { params }));
  }
}
