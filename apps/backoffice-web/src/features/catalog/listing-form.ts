import { formatVnd } from "@hayi/domain-utils";
import type { StatusBadgeTone } from "@hayi/ui";
import type { BackofficeComponents } from "@hayi/api-client";
import type { BranchListing, ListingState } from "./api/listings";
import { parsePrice } from "./product-form";

type VariantInput = BackofficeComponents["schemas"]["BranchVariantListingInput"];

/** State at the Branch (Catalog §5.5); a Product without a listing is not sold there. */
export const listingStateLabel: Record<ListingState | "NONE", string> = {
  AVAILABLE: "Đang bán",
  NOT_AVAILABLE: "Chưa bán",
  SOLD_OUT: "Hết hàng",
  PAUSED: "Tạm dừng",
  NONE: "Chưa bán",
};

export const listingStateTone: Record<ListingState | "NONE", StatusBadgeTone> = {
  AVAILABLE: "success",
  NOT_AVAILABLE: "neutral",
  SOLD_OUT: "danger",
  PAUSED: "warning",
  NONE: "neutral",
};

/** Sold at the Branch: listed and not taken off (sold out / paused still count as on the menu). */
export const isSelling = (listing: BranchListing | null) => listing !== null && listing.availabilityState !== "NOT_AVAILABLE";

/** "M 48.000 ₫ · L 55.000 ₫ (M giá riêng)": the price customers pay per size at the Branch (AD4). */
export function priceSummary(listing: BranchListing | null): string {
  if (!listing || listing.variants.length === 0) return "—";
  const prices = listing.variants.map((v) => `${v.name} ${formatVnd(v.effectivePrice)}`).join(" · ");
  const own = listing.variants.filter((v) => v.price !== null).map((v) => v.name);
  return own.length > 0 ? `${prices} (${own.join(", ")} giá riêng)` : prices;
}

/** One size as typed; `price` `""` = the base price (AD4). */
export interface SizePriceRow {
  variantId: string;
  name: string;
  basePrice: number;
  price: string;
  selling: boolean;
}

export function sizeRowsOf(listing: BranchListing): SizePriceRow[] {
  return listing.variants.map((v) => ({
    variantId: v.variantId,
    name: v.name,
    basePrice: v.basePrice,
    price: v.price === null ? "" : formatVnd(v.price),
    selling: v.availabilityState !== "NOT_AVAILABLE",
  }));
}

/** Something typed is not on the server yet. */
export function sizesEdited(rows: readonly SizePriceRow[], listing: BranchListing): boolean {
  return JSON.stringify(rows) !== JSON.stringify(sizeRowsOf(listing));
}

/**
 * The rows on top of a newer listing (after "Tải lại", the #35 pattern): a size the user has not changed since
 * `before` takes the new values, a typed one stays; sizes gone from the listing go, new ones appear.
 */
export function rebaseSizes(rows: readonly SizePriceRow[], before: BranchListing, after: BranchListing): SizePriceRow[] {
  const old = new Map(sizeRowsOf(before).map((r) => [r.variantId, r]));
  const typed = new Map(rows.map((r) => [r.variantId, r]));
  return sizeRowsOf(after).map((fresh) => {
    const mine = typed.get(fresh.variantId);
    const was = old.get(fresh.variantId);
    if (!mine || !was) return fresh;
    return {
      ...fresh,
      price: mine.price === was.price ? fresh.price : mine.price,
      selling: mine.selling === was.selling ? fresh.selling : mine.selling,
    };
  });
}

export type SizeErrors = Partial<Record<string, string>>;

/** Prices must be whole VND or empty (base price); negatives are not typed (no minus sign accepted). */
export function sizeErrors(rows: readonly SizePriceRow[]): SizeErrors {
  const errors: SizeErrors = {};
  for (const row of rows) {
    if (row.price.trim() !== "" && parsePrice(row.price) === null) {
      errors[row.variantId] = "Nhập giá đầy đủ, ví dụ 48.000, hoặc để trống để dùng giá gốc.";
    }
  }
  return errors;
}

/** One `PUT …/variants/{variantId}` per size that changed (price or selling), in size order. */
export function sizeChanges(listing: BranchListing, rows: readonly SizePriceRow[]): { variantId: string; body: VariantInput }[] {
  const byId = new Map(listing.variants.map((v) => [v.variantId, v]));
  return rows.flatMap((row) => {
    const current = byId.get(row.variantId);
    if (!current) return [];
    const price = row.price.trim() === "" ? null : parsePrice(row.price);
    const selling = current.availabilityState !== "NOT_AVAILABLE";
    if (price === current.price && row.selling === selling) return [];
    // Changing only the price keeps a sold-out / paused size as it is (W2): AVAILABLE means "on the menu".
    return [{ variantId: row.variantId, body: { price, availabilityState: row.selling ? "AVAILABLE" : "NOT_AVAILABLE" } }];
  });
}
