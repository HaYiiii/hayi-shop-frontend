import { formatVnd } from "@hayi/domain-utils";
import { describe, expect, it } from "vitest";
import { isSelling, priceSummary, sizeChanges, sizeErrors, sizeRowsOf } from "./listing-form";
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

  it("checks typed prices", () => {
    const rows = sizeRowsOf(aListing());
    expect(sizeErrors([{ ...rows[0]!, price: "-5" }, rows[1]!])).toEqual({
      "v-m": "Nhập giá đầy đủ, ví dụ 48.000, hoặc để trống để dùng giá gốc.",
    });
  });
});
