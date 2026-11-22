import { ApiError } from "@hayi/api-client";
import type { Collection, CollectionPatch } from "./api/collections";

/** Limits of Decision AL1 / AL2. */
export const COLLECTION_TEXT_MAX = 128;
export const COLLECTION_PRODUCTS_MAX = 200;
export const TAG_TEXT_MAX = 64;
const slugPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** What the collection card holds (D3d screen 28). */
export interface CollectionDraft {
  name: string;
  slug: string;
  productIds: string[];
}

export type CollectionErrors = Partial<Record<"name" | "slug" | "products", string>>;

export function draftOfCollection(collection: Collection): CollectionDraft {
  return { name: collection.name, slug: collection.slug, productIds: [...collection.productIds] };
}

export function moveProduct(draft: CollectionDraft, productId: string, by: -1 | 1): CollectionDraft {
  const ids = [...draft.productIds];
  const from = ids.indexOf(productId);
  const to = from + by;
  if (from < 0 || to < 0 || to >= ids.length) return draft;
  [ids[from], ids[to]] = [ids[to]!, ids[from]!];
  return { ...draft, productIds: ids };
}

export function removeProduct(draft: CollectionDraft, productId: string): CollectionDraft {
  return { ...draft, productIds: draft.productIds.filter((id) => id !== productId) };
}

/** Added last, once (a product can be in many collections, but once in each). */
export function addProduct(draft: CollectionDraft, productId: string): CollectionDraft {
  if (draft.productIds.includes(productId) || draft.productIds.length >= COLLECTION_PRODUCTS_MAX) return draft;
  return { ...draft, productIds: [...draft.productIds, productId] };
}

/** Name and slug checks the server makes (AL1 / AL2), with the field's limit. */
export function textErrors(name: string, slug: string, max: number): CollectionErrors {
  const errors: CollectionErrors = {};
  if (!name.trim()) errors.name = "Nhập tên.";
  else if (name.trim().length > max) errors.name = `Tên tối đa ${max} ký tự.`;
  const s = slug.trim();
  if (!s) errors.slug = "Nhập đường dẫn, ví dụ mua-thu.";
  else if (s.length > max || !slugPattern.test(s)) errors.slug = "Chỉ dùng chữ thường không dấu, số và dấu gạch ngang, ví dụ mua-thu.";
  return errors;
}

/** The two requests a save may need: the collection's fields, then its product list (both with `If-Match`). */
export function collectionChanges(collection: Collection, draft: CollectionDraft): { patch: CollectionPatch | null; productIds: string[] | null } {
  const patch: CollectionPatch = {};
  if (draft.name.trim() !== collection.name) patch.name = draft.name.trim();
  if (draft.slug.trim() !== collection.slug) patch.slug = draft.slug.trim();
  const productsChanged = JSON.stringify(draft.productIds) !== JSON.stringify(collection.productIds);
  return { patch: Object.keys(patch).length > 0 ? patch : null, productIds: productsChanged ? draft.productIds : null };
}

/**
 * "Tải lại" after a conflict (the #35 pattern): what was typed since `base` stays, the rest comes from `latest`.
 */
export function rebaseDraft(base: Collection, draft: CollectionDraft, latest: Collection): CollectionDraft {
  const from = draftOfCollection(base);
  const next = draftOfCollection(latest);
  return {
    name: draft.name !== from.name ? draft.name : next.name,
    slug: draft.slug !== from.slug ? draft.slug : next.slug,
    productIds: JSON.stringify(draft.productIds) !== JSON.stringify(from.productIds) ? draft.productIds : next.productIds,
  };
}

/**
 * Moving a collection one place in the list (agreed 2026-11-21: the API has only `sortOrder` per collection).
 * The new order is renumbered 0…n-1 and every collection whose `sortOrder` differs from its new position is
 * sent, so gaps (archived collections) and ties never leave two collections on one value.
 */
export function reorderCollections(collections: readonly Collection[], collectionId: string, by: -1 | 1): { collection: Collection; sortOrder: number }[] | null {
  const from = collections.findIndex((c) => c.collectionId === collectionId);
  const to = from + by;
  if (from < 0 || to < 0 || to >= collections.length) return null;
  const order = [...collections];
  [order[from], order[to]] = [order[to]!, order[from]!];
  return order.flatMap((collection, sortOrder) => (collection.sortOrder === sortOrder ? [] : [{ collection, sortOrder }]));
}

/** A product in the list was archived or removed meanwhile (API 08 §1: `PUT /collections/{id}/products`). */
export function productGone(error: unknown): boolean {
  return error instanceof ApiError && (error.code === "CATALOG_PRODUCT_ARCHIVED" || error.code === "CATALOG_PRODUCT_NOT_FOUND");
}

/** Problem codes of the collection / tag writes, in words (API 08 §4). */
export function collectionErrorText(error: unknown): { field?: "slug"; text: string; reload?: boolean } {
  const code = error instanceof ApiError ? error.code : undefined;
  switch (code) {
    case "CATALOG_SLUG_TAKEN":
      return { field: "slug", text: "Đường dẫn này đã được dùng. Đặt đường dẫn khác." };
    case "VERSION_CONFLICT":
      return { text: "Bộ sưu tập vừa được người khác cập nhật. Tải lại rồi lưu lại.", reload: true };
    case "CATALOG_COLLECTION_ARCHIVED":
    case "CATALOG_COLLECTION_NOT_FOUND":
      return { text: "Bộ sưu tập này vừa được lưu trữ. Tải lại để xem danh sách mới.", reload: true };
    case "CATALOG_PRODUCT_ARCHIVED":
    case "CATALOG_PRODUCT_NOT_FOUND":
      return { text: "Một món trong danh sách vừa được lưu trữ. Bỏ món đó rồi lưu lại.", reload: true };
    case "CATALOG_TAG_NOT_FOUND":
      return { text: "Tag này không còn. Tải lại để xem danh sách tag mới.", reload: true };
    default:
      return { text: "Chưa lưu được. Bạn thử lại sau ít phút nhé." };
  }
}
