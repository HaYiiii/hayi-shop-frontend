import type { Category, CategoryCreateRequest, CategoryNode, CategoryPatch, CategoryReorderRequest } from "./api/categories";

export type CategoryFieldName = "name" | "slug" | "parentId" | "description";
export const categoryFieldNames: readonly CategoryFieldName[] = ["name", "slug", "parentId", "description"];
export type CategoryFieldErrors = Partial<Record<CategoryFieldName, string>>;

/** What the add / edit form holds; `parentId` `""` = a root. */
export interface CategoryFields {
  name: string;
  slug: string;
  parentId: string;
  description: string;
}

/** Decision Y1: lower-case kebab-case. */
const slugPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const SLUG_MAX = 128;
export const NAME_MAX = 128;
export const DESCRIPTION_MAX = 500;

export function isSlug(value: string): boolean {
  return value.length <= SLUG_MAX && slugPattern.test(value);
}

/** "Trà sữa đá xay" → "tra-sua-da-xay": Vietnamese marks dropped, `đ` → `d`, anything else → `-`. */
export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX)
    .replace(/-+$/, "");
}

export function fieldsOf(category: Category): CategoryFields {
  return {
    name: category.name,
    slug: category.slug,
    parentId: category.parentId ?? "",
    description: category.description ?? "",
  };
}

export function readFields(form: HTMLFormElement): CategoryFields {
  const data = new FormData(form);
  const text = (name: CategoryFieldName) => {
    const value = data.get(name);
    return typeof value === "string" ? value : "";
  };
  return { name: text("name").trim(), slug: text("slug").trim(), parentId: text("parentId"), description: text("description").trim() };
}

/** Checks the server would also make, so the user sees them under the field before sending. */
export function localErrors(fields: CategoryFields): CategoryFieldErrors {
  const errors: CategoryFieldErrors = {};
  if (!fields.name) errors.name = "Nhập tên danh mục.";
  if (!fields.slug) errors.slug = "Nhập đường dẫn, ví dụ tra-trai-cay.";
  else if (!isSlug(fields.slug)) errors.slug = "Chỉ dùng chữ thường không dấu, số và dấu gạch ngang, ví dụ tra-trai-cay.";
  return errors;
}

export function createBody(fields: CategoryFields): CategoryCreateRequest {
  return {
    slug: fields.slug,
    name: fields.name,
    ...(fields.description && { description: fields.description }),
    ...(fields.parentId && { parentId: fields.parentId }),
  };
}

/** JSON Merge Patch of the changed fields only; an emptied description is `null` (Decision Y3). */
export function patchBody(category: Category, fields: CategoryFields): CategoryPatch {
  const before = fieldsOf(category);
  const body: CategoryPatch = {};
  if (fields.name !== before.name) body.name = fields.name;
  if (fields.slug !== before.slug) body.slug = fields.slug;
  if (fields.description !== before.description) body.description = fields.description || null;
  if (fields.parentId !== before.parentId) body.parentId = fields.parentId || null;
  return body;
}

/** `errors[]` of a `400 VALIDATION_FAILED`, by form field. */
export function fieldErrors(errors: readonly { field: string; message?: string }[]): CategoryFieldErrors {
  const result: CategoryFieldErrors = {};
  for (const error of errors) {
    const name = error.field as CategoryFieldName;
    if (categoryFieldNames.includes(name)) result[name] ??= error.message ?? "Giá trị chưa hợp lệ.";
  }
  return result;
}

export const isActive = (category: Category) => category.status === "ACTIVE";

/** The tree without archived Categories. */
export function activeTree(tree: readonly CategoryNode[]): CategoryNode[] {
  return tree.filter(isActive).map((root) => ({ ...root, children: root.children.filter(isActive) }));
}

export function countArchived(tree: readonly CategoryNode[]): number {
  return tree.reduce((n, root) => n + (isActive(root) ? 0 : 1) + root.children.filter((c) => !isActive(c)).length, 0);
}

/**
 * The order request that moves `categoryId` one place up or down among its active siblings, or `null`
 * at the end of its group. The request lists exactly the active group (Decision Y6).
 */
export function moveRequest(
  tree: readonly CategoryNode[],
  categoryId: string,
  direction: "up" | "down",
): CategoryReorderRequest | null {
  const active = activeTree(tree);
  const parent = active.find((root) => root.children.some((c) => c.categoryId === categoryId));
  const group: readonly Category[] = parent ? parent.children : active;
  const ids = group.map((c) => c.categoryId);
  const from = ids.indexOf(categoryId);
  const to = direction === "up" ? from - 1 : from + 1;
  if (from < 0 || to < 0 || to >= ids.length) return null;
  [ids[from], ids[to]] = [ids[to]!, ids[from]!];
  return { parentId: parent?.categoryId ?? null, categoryIds: ids };
}

/** Find a Category anywhere in the tree. */
export function findCategory(tree: readonly CategoryNode[], categoryId: string): Category | CategoryNode | undefined {
  for (const root of tree) {
    if (root.categoryId === categoryId) return root;
    const child = root.children.find((c) => c.categoryId === categoryId);
    if (child) return child;
  }
  return undefined;
}
