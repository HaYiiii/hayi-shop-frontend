import { formatVnd } from "@hayi/domain-utils";
import type { StatusBadgeTone } from "@hayi/ui";
import type { BackofficeComponents } from "@hayi/api-client";
import type { OptionGroup } from "./api/option-groups";
import type { BranchListing, ListingState, OptionItemListing } from "./api/listings";
import type { Product } from "./api/products";
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

/**
 * One option item of the Product as typed (D3d screen 29). The Branch price belongs to the item, so it applies
 * to every Product using it at this Branch (AD3). `price` `""` = as the Product (AD4).
 */
export interface OptionPriceRow {
  optionItemId: string;
  name: string;
  groupName: string;
  /** Extra price at the Product: its override, else the library price. */
  productPrice: number;
  price: string;
  /** Version of the item's Branch listing; `0` = none yet (sent as `"v0"`). */
  version: number;
}

/** The items customers can pick in this Product (attached groups, active, not hidden here), in group order. */
export function optionRowsOf(product: Product, library: readonly OptionGroup[], listings: readonly OptionItemListing[]): OptionPriceRow[] {
  const groups = new Map(library.map((g) => [g.optionGroupId, g]));
  const overrides = new Map(product.optionItemOverrides.map((o) => [o.optionItemId, o]));
  const listed = new Map(listings.map((l) => [l.optionItemId, l]));
  return [...product.optionGroups]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .flatMap((attached) => {
      const group = groups.get(attached.optionGroupId);
      if (!group || group.status !== "ACTIVE") return [];
      return [...group.items]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .filter((item) => item.status === "ACTIVE" && !overrides.get(item.optionItemId)?.isHidden)
        .map((item) => {
          const listing = listed.get(item.optionItemId);
          return {
            optionItemId: item.optionItemId,
            name: item.name,
            groupName: group.name,
            productPrice: overrides.get(item.optionItemId)?.extraPriceOverride ?? item.defaultExtraPrice,
            price: listing?.extraPrice == null ? "" : formatVnd(listing.extraPrice),
            version: listing?.version ?? 0,
          };
        });
    });
}

const priceOf = (text: string) => (text.trim() === "" ? null : parsePrice(text));

/** One `PUT /option-item-listings/{id}` per item whose Branch price changed, with the item's own version. */
export function optionChanges(before: readonly OptionPriceRow[], rows: readonly OptionPriceRow[]) {
  const was = new Map(before.map((r) => [r.optionItemId, r]));
  return rows.flatMap((row) => {
    const old = was.get(row.optionItemId);
    if (!old || priceOf(row.price) === priceOf(old.price)) return [];
    return [{ optionItemId: row.optionItemId, version: old.version, extraPrice: priceOf(row.price) }];
  });
}

export function optionErrors(rows: readonly OptionPriceRow[]): SizeErrors {
  const errors: SizeErrors = {};
  for (const row of rows) {
    if (row.price.trim() !== "" && parsePrice(row.price) === null) {
      errors[row.optionItemId] = "Nhập giá thêm, ví dụ 5.000, hoặc để trống để như món.";
    }
  }
  return errors;
}

/** After "Tải lại": an item the user did not change takes the new price and version; a typed one keeps its text. */
export function rebaseOptionRows(rows: readonly OptionPriceRow[], before: readonly OptionPriceRow[], after: readonly OptionPriceRow[]): OptionPriceRow[] {
  const typed = new Map(rows.map((r) => [r.optionItemId, r]));
  const old = new Map(before.map((r) => [r.optionItemId, r]));
  return after.map((fresh) => {
    const mine = typed.get(fresh.optionItemId);
    const was = old.get(fresh.optionItemId);
    return mine && was && mine.price !== was.price ? { ...fresh, price: mine.price } : fresh;
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
