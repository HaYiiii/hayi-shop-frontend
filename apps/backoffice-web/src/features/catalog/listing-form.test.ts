import { formatVnd } from "@hayi/domain-utils";
import { describe, expect, it } from "vitest";
import { isSelling, priceSummary, rebaseSizes, sizeChanges, sizeErrors, sizeRowsOf, sizesEdited } from "./listing-form";
import { aListing } from "./test/listings";

const nbsp = (text: string) => text.replace(/\s/g, " ");

describe("priceSummary", () => {
  it("lists the price customers pay per size and names the sizes with a Branch price", () => {
    expect(nbsp(priceSummary(aListing()))).toBe("M 48.000 ₫ · L 55.000 ₫ (M giá riêng)");
    expect(priceSummary(null)).toBe("—");
  });
});

describe("isSelling", () => {
  it("counts sold-out and paused as still on the menu", () => {
    expect(isSelling(aListing({ availabilityState: "SOLD_OUT" }))).toBe(true);
    expect(isSelling(aListing({ availabilityState: "NOT_AVAILABLE" }))).toBe(false);
    expect(isSelling(null)).toBe(false);
  });
});

describe("size rows", () => {
  it("holds the Branch price as typed text, empty for the base price", () => {
    expect(sizeRowsOf(aListing())).toEqual([
      { variantId: "v-m", name: "M", basePrice: 45000, price: formatVnd(48000), selling: true },
      { variantId: "v-l", name: "L", basePrice: 55000, price: "", selling: true },
    ]);
  });

  it("sends only the sizes that changed, full price or null for the base price", () => {
    const listing = aListing();
    const rows = sizeRowsOf(listing);
    expect(sizeChanges(listing, rows)).toEqual([]);
    const edited = [{ ...rows[0]!, price: "" }, { ...rows[1]!, price: "57.000", selling: false }];
    expect(sizeChanges(listing, edited)).toEqual([
      { variantId: "v-m", body: { price: null, availabilityState: "AVAILABLE" } },
      { variantId: "v-l", body: { price: 57000, availabilityState: "NOT_AVAILABLE" } },
    ]);
  });

  it("rebases typed sizes on a newer listing: typed values stay, untouched ones take the new values", () => {
    const before = aListing();
    const rows = sizeRowsOf(before);
    const typed = [{ ...rows[0]!, price: "50.000" }, rows[1]!];
    expect(sizesEdited(typed, before)).toBe(true);
    const after = aListing({
      version: 7,
      variants: [
        { ...before.variants[0]!, price: 49000, effectivePrice: 49000 },
        { ...before.variants[1]!, price: 58000, effectivePrice: 58000 },
      ],
    });
    expect(rebaseSizes(typed, before, after).map((r) => r.price)).toEqual(["50.000", formatVnd(58000)]);
    expect(sizesEdited(sizeRowsOf(after), after)).toBe(false);
  });

  it("checks typed prices", () => {
    const rows = sizeRowsOf(aListing());
    expect(sizeErrors([{ ...rows[0]!, price: "-5" }, rows[1]!])).toEqual({
      "v-m": "Nhập giá đầy đủ, ví dụ 48.000, hoặc để trống để dùng giá gốc.",
    });
  });
});
