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
