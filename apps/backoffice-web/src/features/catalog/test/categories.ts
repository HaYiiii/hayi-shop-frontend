import { json } from "../../../test/fake-api";
import type { Category, CategoryNode, CategoryTree } from "../api/categories";

export type { Category, CategoryNode };

export function aCategory(overrides: Partial<Category> = {}): Category {
  return {
    categoryId: "c-tea",
    slug: "tra",
    name: "Trà",
    description: null,
    parentId: null,
    sortOrder: 1,
    status: "ACTIVE",
    version: 2,
    createdAt: "2026-11-01T03:00:00Z",
    updatedAt: "2026-11-01T03:00:00Z",
    ...overrides,
  };
}

interface TreeOptions {
  teaName?: string;
  extraRoot?: Category;
  withoutMilk?: boolean;
  milkFirst?: boolean;
  /** Adds an archived root (as `?includeArchived=true` returns it). */
  archived?: boolean;
}

/** Trà (Trà vải, Trà đào) and Sữa chua, in that order. */
export function aTree(options: TreeOptions = {}): CategoryTree {
  const tea: CategoryNode = {
    ...aCategory({ name: options.teaName ?? "Trà" }),
    children: [
      aCategory({ categoryId: "c-tea-lychee", slug: "tra-vai", name: "Trà vải", parentId: "c-tea", sortOrder: 1 }),
      aCategory({ categoryId: "c-tea-peach", slug: "tra-dao", name: "Trà đào", parentId: "c-tea", sortOrder: 2 }),
    ],
  };
  const milk: CategoryNode = {
    ...aCategory({ categoryId: "c-milk", slug: "sua-chua", name: "Sữa chua", sortOrder: 2, version: 5 }),
    children: [],
  };
  let items: CategoryNode[] = options.withoutMilk ? [tea] : options.milkFirst ? [milk, tea] : [tea, milk];
  if (options.extraRoot) items = [...items, { ...options.extraRoot, children: [] }];
  if (options.archived) {
    items = [
      ...items,
      { ...aCategory({ categoryId: "c-old", slug: "mon-cu", name: "Món cũ", sortOrder: 9, status: "ARCHIVED" }), children: [] },
    ];
  }
  return { items };
}

/** A Category response with its `ETag` (API README §8). */
export function categoryResponse(category: Category, status = 200) {
  const response = json(category, status);
  response.headers.set("ETag", `"v${category.version}"`);
  return response;
}
