import { ApiError } from "@hayi/api-client";
import type { ProductCreateRequest } from "./api/products";

/** Limits of `POST /products` (API 08 §1.3, Decision Z). */
export const NAME_MAX = 160;
export const SLUG_MAX = 160;
export const CODE_MAX = 64;
export const SHORT_DESCRIPTION_MAX = 500;
export const VARIANT_NAME_MAX = 128;
export const VARIANT_MAX = 20;

const codePattern = /^[A-Za-z0-9][A-Za-z0-9-]{0,63}$/;
const slugPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** One size row as typed; `price` is the text of the input ("45.000 ₫"). */
export interface VariantRow {
  key: string;
  sku: string;
  name: string;
  price: string;
}

/** What the create form holds (D3d screen 22). `primaryCategoryId` `""` = none yet (allowed while DRAFT). */
export interface ProductDraft {
  name: string;
  productCode: string;
  slug: string;
  primaryCategoryId: string;
  shortDescription: string;
  variants: VariantRow[];
  /** `key` of the default size. */
  defaultKey: string;
}

/** Field paths as the API names them in `errors[].field`, plus `variants` for the size section. */
export type ProductFieldPath =
  | "name"
  | "productCode"
  | "slug"
  | "primaryCategoryId"
  | "shortDescription"
  | "variants"
  | `variants[${number}].${"sku" | "name" | "basePrice"}`;
export type ProductFieldErrors = Partial<Record<ProductFieldPath, string>>;

const topFields = ["name", "productCode", "slug", "primaryCategoryId", "shortDescription"] as const;
const variantField = /^variants\[(\d+)\]\.(sku|name|basePrice)$/;

/** The field paths in form order, for "focus the first error". */
export function fieldOrder(draft: ProductDraft): ProductFieldPath[] {
  return [
    ...topFields,
    "variants",
    ...draft.variants.flatMap((_, i) => [`variants[${i}].sku`, `variants[${i}].name`, `variants[${i}].basePrice`] as const),
  ];
}

export function emptyDraft(newKey: () => string): ProductDraft {
  const key = newKey();
  return {
    name: "",
    productCode: "",
    slug: "",
    primaryCategoryId: "",
    shortDescription: "",
    variants: [{ key, sku: "", name: "", price: "" }],
    defaultKey: key,
  };
}

export function addVariant(draft: ProductDraft, key: string): ProductDraft {
  if (draft.variants.length >= VARIANT_MAX) return draft;
  return { ...draft, variants: [...draft.variants, { key, sku: "", name: "", price: "" }] };
}

/** Removes a size; the last one stays. Removing the default makes the first remaining size the default. */
export function removeVariant(draft: ProductDraft, key: string): ProductDraft {
  if (draft.variants.length <= 1) return draft;
  const variants = draft.variants.filter((v) => v.key !== key);
  const defaultKey = draft.defaultKey === key ? variants[0]!.key : draft.defaultKey;
  return { ...draft, variants, defaultKey };
}

/** "45.000 ₫", "45000", "1 250 000" → VND integer; anything else (empty, negative, letters) → `null`. */
export function parsePrice(text: string): number | null {
  const digits = text.replace(/[\s.₫]/g, "").replace(/đ$/i, "");
  if (!/^\d+$/.test(digits)) return null;
  const amount = Number(digits);
  return Number.isSafeInteger(amount) ? amount : null;
}

/** Checks the server would also make (API 08 §1.3), so the user sees them under the field before sending. */
export function localErrors(draft: ProductDraft): ProductFieldErrors {
  const errors: ProductFieldErrors = {};
  if (!draft.name.trim()) errors.name = "Nhập tên món.";
  const code = draft.productCode.trim();
  if (!code) errors.productCode = "Nhập mã món, ví dụ MATCHA-LATTE.";
  else if (!codePattern.test(code)) {
    errors.productCode = "Chỉ dùng chữ, số và dấu gạch ngang, bắt đầu bằng chữ hoặc số, tối đa 64 ký tự.";
  }
  const slug = draft.slug.trim();
  if (!slug) errors.slug = "Nhập đường dẫn, ví dụ matcha-latte.";
  else if (slug.length > SLUG_MAX || !slugPattern.test(slug)) {
    errors.slug = "Chỉ dùng chữ thường không dấu, số và dấu gạch ngang, ví dụ matcha-latte.";
  }

  const seen = new Map<string, number>();
  draft.variants.forEach((variant, i) => {
    const sku = variant.sku.trim().toUpperCase();
    if (!sku) errors[`variants[${i}].sku`] = "Nhập mã SKU.";
    else if (!codePattern.test(sku)) errors[`variants[${i}].sku`] = "Chỉ dùng chữ, số và dấu gạch ngang, tối đa 64 ký tự.";
    else if (seen.has(sku)) errors[`variants[${i}].sku`] = `Mã SKU trùng với size ${seen.get(sku)! + 1}.`;
    else seen.set(sku, i);
    if (!variant.name.trim()) errors[`variants[${i}].name`] = "Nhập tên size.";
    if (parsePrice(variant.price) === null) errors[`variants[${i}].basePrice`] = "Nhập giá gốc, ví dụ 45.000.";
  });
  return errors;
}

/** The request body; call only when `localErrors` is empty. Codes are sent upper-cased (Decision Z2). */
export function createBody(draft: ProductDraft): ProductCreateRequest {
  const shortDescription = draft.shortDescription.trim();
  return {
    productCode: draft.productCode.trim().toUpperCase(),
    name: draft.name.trim(),
    slug: draft.slug.trim(),
    ...(draft.primaryCategoryId && { primaryCategoryId: draft.primaryCategoryId }),
    ...(shortDescription && { shortDescription }),
    variants: draft.variants.map((variant) => ({
      sku: variant.sku.trim().toUpperCase(),
      name: variant.name.trim(),
      basePrice: parsePrice(variant.price) ?? 0,
      isDefault: variant.key === draft.defaultKey,
    })),
  };
}

function isFieldPath(field: string, draft: ProductDraft): field is ProductFieldPath {
  if ((topFields as readonly string[]).includes(field)) return true;
  const match = variantField.exec(field);
  return match !== null && Number(match[1]) < draft.variants.length;
}

const skuTaken = "Mã SKU này đã được dùng, kể cả bởi món đã lưu trữ. Đặt mã khác.";

/** Problem codes of `POST /products` shown under a field (D2 "Bố cục form", screen 22). */
export function serverErrors(error: unknown, draft: ProductDraft): ProductFieldErrors {
  if (!(error instanceof ApiError)) return {};
  const fields = (error.problem.errors ?? []).filter((e) => isFieldPath(e.field, draft));
  const byField = (message: (given?: string) => string): ProductFieldErrors => {
    const result: ProductFieldErrors = {};
    for (const e of fields) result[e.field as ProductFieldPath] ??= message(e.message);
    return result;
  };
  switch (error.code) {
    case "CATALOG_CODE_TAKEN":
      return { productCode: "Mã món này đã được dùng, kể cả bởi món đã lưu trữ. Đặt mã khác." };
    case "CATALOG_SLUG_TAKEN":
      return { slug: "Đường dẫn này đã được dùng cho món khác. Đặt đường dẫn khác." };
    case "CATALOG_CATEGORY_ARCHIVED":
      return { primaryCategoryId: "Danh mục này vừa được lưu trữ. Chọn danh mục khác." };
    case "CATALOG_CATEGORY_NOT_FOUND":
      return { primaryCategoryId: "Danh mục này không còn. Chọn danh mục khác." };
    case "CATALOG_SKU_TAKEN":
      // The Problem may not say which SKU: then the only size, or the size section.
      if (fields.length > 0) return byField(() => skuTaken);
      if (draft.variants.length === 1) return { "variants[0].sku": skuTaken };
      return { variants: "Một mã SKU đã được dùng, kể cả bởi món đã lưu trữ. Kiểm tra lại các mã SKU." };
    case "CATALOG_PRICE_NEGATIVE":
      return byField(() => "Giá gốc không được âm.");
    case "VALIDATION_FAILED":
      return byField((given) => given ?? "Giá trị chưa hợp lệ.");
    default:
      return {};
  }
}
