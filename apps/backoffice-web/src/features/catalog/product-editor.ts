import { ApiError, type BackofficeComponents } from "@hayi/api-client";
import { formatVnd } from "@hayi/domain-utils";
import type { Product } from "./api/products";
import { NAME_MAX, SHORT_DESCRIPTION_MAX, SLUG_MAX, VARIANT_MAX, VARIANT_NAME_MAX, parsePrice } from "./product-form";

type Schemas = BackofficeComponents["schemas"];
export type ProductPatch = Schemas["ProductPatch"];
export type VariantPatch = Schemas["ProductVariantPatch"];
export type VariantInput = Schemas["ProductVariantInput"];
export type VariantStatus = Schemas["VariantStatus"];
export type ActivationIssue = Schemas["ProductActivationProblem"]["issues"][number];

export const DESCRIPTION_MAX = 10000;

const codePattern = /^[A-Za-z0-9][A-Za-z0-9-]{0,63}$/;
const slugPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** One size as typed. A saved size is keyed by its `variantId`; `variantId` `null` = new, not sent yet. */
export interface SizeRow {
  key: string;
  variantId: string | null;
  sku: string;
  name: string;
  /** The input text, "55.000 ₫". */
  price: string;
  status: VariantStatus;
}

/** What tab "Thông tin & size" holds (D3d screen 23). Empty strings are "none" for the optional fields. */
export interface ProductEditor {
  name: string;
  slug: string;
  primaryCategoryId: string;
  shortDescription: string;
  description: string;
  sizes: SizeRow[];
  /** `key` of the default size. */
  defaultKey: string;
}

export type EditorFieldPath =
  | "name"
  | "slug"
  | "primaryCategoryId"
  | "shortDescription"
  | "description"
  | "sizes"
  | `sizes[${number}].${"sku" | "name" | "basePrice"}`;
export type EditorFieldErrors = Partial<Record<EditorFieldPath, string>>;

const productFields = ["name", "slug", "primaryCategoryId", "shortDescription", "description"] as const;
const sizeFields = ["sku", "name", "basePrice"] as const;

/** Field paths in form order, for "focus the first error". */
export function fieldOrder(editor: ProductEditor): EditorFieldPath[] {
  return [...productFields, "sizes", ...editor.sizes.flatMap((_, i) => sizeFields.map((f) => `sizes[${i}].${f}` as const))];
}

/** The editor for a Product: its fields and the sizes that are not archived, in their order. */
export function editorOf(product: Product): ProductEditor {
  const variants = product.variants.filter((v) => v.status !== "ARCHIVED").sort((a, b) => a.sortOrder - b.sortOrder);
  return {
    name: product.name,
    slug: product.slug,
    primaryCategoryId: product.primaryCategoryId ?? "",
    shortDescription: product.shortDescription ?? "",
    description: product.description ?? "",
    sizes: variants.map((v) => ({
      key: v.variantId,
      variantId: v.variantId,
      sku: v.sku,
      name: v.name,
      price: formatVnd(v.basePrice),
      status: v.status,
    })),
    defaultKey: (variants.find((v) => v.isDefault) ?? variants[0])?.variantId ?? "",
  };
}

/** The user typed something that is not on the server yet. */
export function isEdited(editor: ProductEditor, product: Product): boolean {
  return JSON.stringify(editor) !== JSON.stringify(editorOf(product));
}

/** Two versions differ only in what this tab does not edit (status after a lifecycle command, dates). */
export function sameContent(a: Product, b: Product): boolean {
  return JSON.stringify(editorOf(a)) === JSON.stringify(editorOf(b));
}

export function setSize(editor: ProductEditor, key: string, change: Partial<Pick<SizeRow, "sku" | "name" | "price">>): ProductEditor {
  return { ...editor, sizes: editor.sizes.map((s) => (s.key === key ? { ...s, ...change } : s)) };
}

/** At most 20 sizes that are not archived (API 08 §1.7). */
export function addSize(editor: ProductEditor, key: string): ProductEditor {
  if (editor.sizes.length >= VARIANT_MAX) return editor;
  const row: SizeRow = { key, variantId: null, sku: "", name: "", price: "", status: "ACTIVE" };
  return { ...editor, sizes: [...editor.sizes, row] };
}

/** A size that was never saved can simply go; a saved one is archived instead. */
export function removeNewSize(editor: ProductEditor, key: string): ProductEditor {
  const sizes = editor.sizes.filter((s) => s.key !== key || s.variantId !== null);
  const defaultKey = sizes.some((s) => s.key === editor.defaultKey) ? editor.defaultKey : (sizes[0]?.key ?? "");
  return { ...editor, sizes, defaultKey };
}

/** Checks the server would also make (API 08 §1.3, §1.7), shown under the field before sending. */
export function localErrors(editor: ProductEditor): EditorFieldErrors {
  const errors: EditorFieldErrors = {};
  const name = editor.name.trim();
  if (!name) errors.name = "Nhập tên món.";
  else if (name.length > NAME_MAX) errors.name = `Tên món tối đa ${NAME_MAX} ký tự.`;
  const slug = editor.slug.trim();
  if (!slug) errors.slug = "Nhập đường dẫn, ví dụ matcha-latte.";
  else if (slug.length > SLUG_MAX || !slugPattern.test(slug)) {
    errors.slug = "Chỉ dùng chữ thường không dấu, số và dấu gạch ngang, ví dụ matcha-latte.";
  }
  if (editor.shortDescription.trim().length > SHORT_DESCRIPTION_MAX) {
    errors.shortDescription = `Mô tả ngắn tối đa ${SHORT_DESCRIPTION_MAX} ký tự.`;
  }
  if (editor.description.trim().length > DESCRIPTION_MAX) errors.description = "Mô tả tối đa 10.000 ký tự.";

  const seen = new Map<string, number>();
  editor.sizes.forEach((size, i) => {
    const sku = size.sku.trim().toUpperCase();
    if (size.variantId === null) {
      if (!sku) errors[`sizes[${i}].sku`] = "Nhập mã SKU.";
      else if (!codePattern.test(sku)) errors[`sizes[${i}].sku`] = "Chỉ dùng chữ, số và dấu gạch ngang, tối đa 64 ký tự.";
      else if (seen.has(sku)) errors[`sizes[${i}].sku`] = `Mã SKU trùng với size ${seen.get(sku)! + 1}.`;
    }
    if (sku && !seen.has(sku)) seen.set(sku, i);
    const sizeName = size.name.trim();
    if (!sizeName) errors[`sizes[${i}].name`] = "Nhập tên size.";
    else if (sizeName.length > VARIANT_NAME_MAX) errors[`sizes[${i}].name`] = `Tên size tối đa ${VARIANT_NAME_MAX} ký tự.`;
    if (parsePrice(size.price) === null) errors[`sizes[${i}].basePrice`] = "Nhập giá gốc, ví dụ 45.000.";
  });
  return errors;
}

/** One request of a save; `index` is the size row it belongs to. */
export type SaveStep =
  | { kind: "product"; body: ProductPatch }
  | { kind: "size"; index: number; variantId: string; body: VariantPatch }
  | { kind: "add"; index: number; body: VariantInput };

const optional = (text: string) => text.trim() || null;

/**
 * The requests that turn `product` into `editor` (API 08 §1.7): the Product patch, then the changed
 * sizes, then new sizes. A new default is sent as `isDefault: true` on it; the server moves the flag.
 */
export function savePlan(product: Product, editor: ProductEditor): SaveStep[] {
  const body: ProductPatch = {};
  if (editor.name.trim() !== product.name) body.name = editor.name.trim();
  if (editor.slug.trim() !== product.slug) body.slug = editor.slug.trim();
  if ((editor.primaryCategoryId || null) !== product.primaryCategoryId) body.primaryCategoryId = editor.primaryCategoryId || null;
  if (optional(editor.shortDescription) !== product.shortDescription) body.shortDescription = optional(editor.shortDescription);
  if (optional(editor.description) !== product.description) body.description = optional(editor.description);

  const byId = new Map(product.variants.map((v) => [v.variantId, v]));
  const steps: SaveStep[] = Object.keys(body).length > 0 ? [{ kind: "product", body }] : [];
  const adding: SaveStep[] = [];
  for (const [index, size] of editor.sizes.entries()) {
    const isDefault = size.key === editor.defaultKey;
    const basePrice = parsePrice(size.price) ?? 0;
    if (size.variantId === null) {
      adding.push({
        kind: "add",
        index,
        body: { sku: size.sku.trim().toUpperCase(), name: size.name.trim(), basePrice, ...(isDefault && { isDefault: true }) },
      });
      continue;
    }
    const variant = byId.get(size.variantId);
    if (!variant || variant.status === "ARCHIVED") continue;
    const patch: VariantPatch = {};
    if (size.name.trim() !== variant.name) patch.name = size.name.trim();
    if (parsePrice(size.price) !== null && basePrice !== variant.basePrice) patch.basePrice = basePrice;
    if (isDefault && !variant.isDefault) patch.isDefault = true;
    if (Object.keys(patch).length > 0) steps.push({ kind: "size", index, variantId: size.variantId, body: patch });
  }
  return [...steps, ...adding];
}

/**
 * The editor on top of a newer version (after "Tải lại", or the Product's own answer to a command):
 * fields the user has not changed since `before` take the new values, typed ones stay; archived sizes
 * go, sizes the server added appear, new rows stay at the end.
 */
export function rebase(editor: ProductEditor, before: Product, after: Product): ProductEditor {
  const old = editorOf(before);
  const fresh = editorOf(after);
  const pick = <K extends (typeof productFields)[number]>(field: K) => (editor[field] === old[field] ? fresh[field] : editor[field]);
  const oldRows = new Map(old.sizes.map((s) => [s.key, s]));

  const sizes: SizeRow[] = fresh.sizes.map((freshRow) => {
    const typed = editor.sizes.find((s) => s.key === freshRow.key);
    const was = oldRows.get(freshRow.key);
    if (!typed || !was) return freshRow;
    const keep = <K extends "name" | "price">(field: K) => (typed[field] === was[field] ? freshRow[field] : typed[field]);
    return { ...freshRow, name: keep("name"), price: keep("price") };
  });
  sizes.push(...editor.sizes.filter((s) => s.variantId === null));

  const defaultKey =
    editor.defaultKey !== old.defaultKey && sizes.some((s) => s.key === editor.defaultKey) ? editor.defaultKey : fresh.defaultKey;
  return {
    name: pick("name"),
    slug: pick("slug"),
    primaryCategoryId: pick("primaryCategoryId"),
    shortDescription: pick("shortDescription"),
    description: pick("description"),
    sizes,
    defaultKey,
  };
}

/** Where a failed request came from: the field paths of its answer depend on it. */
export type ErrorSource = { kind: "product" } | { kind: "size"; index: number } | { kind: "add"; index: number };

function pathOf(field: string, source: ErrorSource): EditorFieldPath | null {
  if (source.kind === "product") return (productFields as readonly string[]).includes(field) ? (field as EditorFieldPath) : null;
  return (sizeFields as readonly string[]).includes(field) ? `sizes[${source.index}].${field as (typeof sizeFields)[number]}` : null;
}

const skuTaken = "Mã SKU này đã được dùng, kể cả bởi món đã lưu trữ. Đặt mã khác.";

/** Problem codes of the tab's writes, shown under a field (D2 "Bố cục form"). */
export function serverErrors(error: unknown, editor: ProductEditor, source: ErrorSource): EditorFieldErrors {
  if (!(error instanceof ApiError)) return {};
  const byField = (message: (given?: string) => string): EditorFieldErrors => {
    const result: EditorFieldErrors = {};
    for (const e of error.problem.errors ?? []) {
      const path = pathOf(e.field, source);
      if (path) result[path] ??= message(e.message);
    }
    return result;
  };
  const sizeIndex = source.kind === "product" ? null : source.index;
  switch (error.code) {
    case "CATALOG_SLUG_TAKEN":
      return { slug: "Đường dẫn này đã được dùng cho món khác. Đặt đường dẫn khác." };
    case "CATALOG_CATEGORY_ARCHIVED":
      return { primaryCategoryId: "Danh mục này vừa được lưu trữ. Chọn danh mục khác." };
    case "CATALOG_CATEGORY_NOT_FOUND":
      return { primaryCategoryId: "Danh mục này không còn. Chọn danh mục khác." };
    case "CATALOG_SKU_TAKEN":
      return sizeIndex !== null && sizeIndex < editor.sizes.length ? { [`sizes[${sizeIndex}].sku`]: skuTaken } : {};
    case "CATALOG_VARIANT_LIMIT_REACHED":
      return { sizes: `Món đã có đủ ${VARIANT_MAX} size. Lưu trữ bớt size cũ trước khi thêm.` };
    case "CATALOG_PRICE_NEGATIVE":
      return sizeIndex !== null ? { [`sizes[${sizeIndex}].basePrice`]: "Giá gốc không được âm." } : {};
    case "VALIDATION_FAILED":
      return byField((given) => given ?? "Giá trị chưa hợp lệ.");
    default:
      return {};
  }
}

/** `issues[]` of `422 PRODUCT_ACTIVATION_INVALID` (Decision AA2), or `null` for any other error. */
export function activationIssues(error: unknown): ActivationIssue[] | null {
  if (!(error instanceof ApiError) || error.code !== "PRODUCT_ACTIVATION_INVALID") return null;
  const issues = error.problem.issues;
  return Array.isArray(issues) ? (issues as ActivationIssue[]) : [];
}
