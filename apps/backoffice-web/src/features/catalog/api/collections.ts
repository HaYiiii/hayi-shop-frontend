import type { BackofficeComponents } from "@hayi/api-client";
import { queryOptions } from "@tanstack/react-query";
import { type BackofficeClient, unwrap } from "../../../lib/api";
import type { ProductSummary } from "./products";

type Schemas = BackofficeComponents["schemas"];
export type Collection = Schemas["Collection"];
export type CollectionPatch = Schemas["CollectionPatch"];
export type Tag = Schemas["Tag"];

export const collectionKeys = {
  all: ["collections"] as const,
  list: () => [...collectionKeys.all, "list"] as const,
};
export const tagKeys = { all: ["tags"] as const };
export const allProductsKey = ["products", "all"] as const;

const ifMatch = (collection: Collection) => ({ "If-Match": `"v${collection.version}"` });
const mergePatch = { "Content-Type": "application/merge-patch+json" };

/** Collections not archived, by `sortOrder` then name (API 08 §1.10, Decision AL1). */
export function collectionsQuery(api: BackofficeClient) {
  return queryOptions({
    queryKey: collectionKeys.list(),
    queryFn: () => unwrap(api.GET("/collections")).then((list) => list.items),
  });
}

export function createCollection(api: BackofficeClient, body: Schemas["CollectionCreateRequest"]) {
  return unwrap(api.POST("/collections", { body }));
}

/** Merge Patch of name, slug, description, `sortOrder`, status; `If-Match` required. */
export function updateCollection(api: BackofficeClient, collection: Collection, body: CollectionPatch) {
  return unwrap(
    api.PATCH("/collections/{collectionId}", {
      params: { path: { collectionId: collection.collectionId }, header: ifMatch(collection) },
      body,
      headers: mergePatch,
    }),
  );
}

/** The products of the collection, in order (replaces the whole list); `If-Match` required. */
export function replaceCollectionProducts(api: BackofficeClient, collection: Collection, productIds: string[]) {
  return unwrap(
    api.PUT("/collections/{collectionId}/products", {
      params: { path: { collectionId: collection.collectionId }, header: ifMatch(collection) },
      body: { productIds },
    }),
  );
}

export function archiveCollection(api: BackofficeClient, collection: Collection) {
  return unwrap(
    api.POST("/collections/{collectionId}/archive", {
      params: { path: { collectionId: collection.collectionId }, header: ifMatch(collection) },
    }),
  );
}

/** Tags by slug (Decision AL2). */
export function tagsQuery(api: BackofficeClient) {
  return queryOptions({ queryKey: tagKeys.all, queryFn: () => unwrap(api.GET("/tags")).then((list) => list.items) });
}

export function createTag(api: BackofficeClient, body: Schemas["TagCreateRequest"]) {
  return unwrap(api.POST("/tags", { body }));
}

/** Merge Patch of name and slug; tags have no version, so no `If-Match` (AL2). */
export function updateTag(api: BackofficeClient, tagId: string, body: Schemas["TagPatch"]) {
  return unwrap(api.PATCH("/tags/{tagId}", { params: { path: { tagId } }, body, headers: mergePatch }));
}

const PAGE = 100;

/** Every Product not archived (for picking products into a collection), page by page of 100 (API 08 §1.3). */
export function allProductsQuery(api: BackofficeClient) {
  return queryOptions({
    queryKey: allProductsKey,
    queryFn: async () => {
      const products: ProductSummary[] = [];
      for (let page = 0; ; page++) {
        const answer = await unwrap(
          api.GET("/products", { params: { query: { size: PAGE, page, status: ["DRAFT", "ACTIVE", "INACTIVE"] } } }),
        );
        products.push(...answer.items);
        if (page + 1 >= answer.page.totalPages) return products;
      }
    },
  });
}
