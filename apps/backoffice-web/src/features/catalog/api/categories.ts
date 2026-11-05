import type { BackofficeComponents } from "@hayi/api-client";
import { queryOptions } from "@tanstack/react-query";
import { type BackofficeClient, unwrap } from "../../../lib/api";

type Schemas = BackofficeComponents["schemas"];
export type Category = Schemas["Category"];
export type CategoryNode = Schemas["CategoryNode"];
export type CategoryTree = Schemas["CategoryTree"];
export type CategoryCreateRequest = Schemas["CategoryCreateRequest"];
export type CategoryPatch = Schemas["CategoryPatch"];
export type CategoryReorderRequest = Schemas["CategoryReorderRequest"];

export const categoryKeys = {
  all: ["categories"] as const,
  tree: (includeArchived: boolean) => [...categoryKeys.all, "tree", { includeArchived }] as const,
};

/** The tree, ≤ 2 levels, sorted by `sortOrder`; only `ACTIVE` unless asked (API 08 §1.2, Decision Y5). */
export function categoryTreeQuery(api: BackofficeClient, includeArchived: boolean) {
  return queryOptions({
    queryKey: categoryKeys.tree(includeArchived),
    queryFn: () =>
      unwrap(api.GET("/categories", includeArchived ? { params: { query: { includeArchived } } } : {})).then(
        (tree) => tree.items,
      ),
  });
}

export function createCategory(api: BackofficeClient, body: CategoryCreateRequest) {
  return unwrap(api.POST("/categories", { body }));
}

/** JSON Merge Patch with `If-Match: "v{version}"` of the Category on screen (Decision Y3). */
export function updateCategory(api: BackofficeClient, category: Category, body: CategoryPatch) {
  return unwrap(
    api.PATCH("/categories/{categoryId}", {
      params: { path: { categoryId: category.categoryId }, header: { "If-Match": `"v${category.version}"` } },
      body,
      headers: { "Content-Type": "application/merge-patch+json" },
    }),
  );
}

/** Archive for good; `If-Match` is optional on commands, sent so a stale screen gets `412` (Decision Y4). */
export function archiveCategory(api: BackofficeClient, category: Category) {
  return unwrap(
    api.POST("/categories/{categoryId}/archive", {
      params: { path: { categoryId: category.categoryId }, header: { "If-Match": `"v${category.version}"` } },
    }),
  );
}

/** The full new order of one sibling group, without `If-Match` (Decision Y6). Answers the active tree. */
export function reorderCategories(api: BackofficeClient, body: CategoryReorderRequest) {
  return unwrap(api.PUT("/categories/order", { body })).then((tree) => tree.items);
}
