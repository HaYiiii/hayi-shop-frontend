import { formatVnd } from "@hayi/domain-utils";
import type { StatusBadgeTone } from "@hayi/ui";
import type { ProductStatus, ProductSummary } from "./api/products";

/** Order of the status chips on screen 21. */
export const productStatusOrder: readonly ProductStatus[] = ["ACTIVE", "DRAFT", "INACTIVE", "ARCHIVED"];

export const productStatusLabel: Record<ProductStatus, string> = {
  ACTIVE: "Đang bán",
  DRAFT: "Nháp",
  INACTIVE: "Tạm ngưng",
  ARCHIVED: "Lưu trữ",
};

export const productStatusTone: Record<ProductStatus, StatusBadgeTone> = {
  ACTIVE: "success",
  DRAFT: "neutral",
  INACTIVE: "warning",
  ARCHIVED: "danger",
};

/**
 * "Từ 45.000 ₫ · 2 size", or the one price. The list has only the lowest base price and the count
 * (API 08 §1.3), not each size: agreed deviation from screen 21, 2026-11-18.
 */
export function priceSummary({ fromPrice, variantCount }: Pick<ProductSummary, "fromPrice" | "variantCount">): string {
  if (fromPrice === null) return "—";
  return variantCount > 1 ? `Từ ${formatVnd(fromPrice)} · ${variantCount} size` : formatVnd(fromPrice);
}
