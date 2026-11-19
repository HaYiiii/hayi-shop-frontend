import { formatVnd } from "@hayi/domain-utils";
import { describe, expect, it } from "vitest";
import {
  isSelling,
  optionChanges,
  optionErrors,
  optionRowsOf,
  priceSummary,
  rebaseOptionRows,
  rebaseSizes,
  sizeChanges,
  sizeErrors,
  sizeRowsOf,
  sizesEdited,
} from "./listing-form";
import { aListing } from "./test/listings";
import { aGroup } from "./test/option-groups";
import { aProduct } from "./test/products";

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

describe("option price rows", () => {
  const product = aProduct({
    optionGroups: [
      { optionGroupId: "g-topping", code: "TOPPING", name: "Topping", selectionType: "MULTIPLE", minSelect: 0, maxSelect: 3, minSelectOverride: null, maxSelectOverride: null, sortOrder: 0 },
    ],
    optionItemOverrides: [
      { optionItemId: "i-pearl", extraPriceOverride: 12000, isHidden: false },
      { optionItemId: "i-jelly", extraPriceOverride: null, isHidden: true },
    ],
  });
  const library = [aGroup({ items: [...aGroup().items, { optionItemId: "i-cheese", code: "CHEESE", name: "Kem cheese", defaultExtraPrice: 12000, isDefaultSelected: false, status: "ACTIVE", sortOrder: 4 }] })];
  const listings = [{ optionItemId: "i-cheese", extraPrice: 15000, availabilityState: "AVAILABLE" as const, version: 2 }];

  it("lists the items customers can pick here with the Product price and the Branch price", () => {
    expect(optionRowsOf(product, library, listings).map((r) => [r.optionItemId, r.groupName, r.productPrice, nbsp(r.price), r.version])).toEqual([
      ["i-pearl", "Topping", 12000, "", 0],
      ["i-cheese", "Topping", 12000, "15.000 ₫", 2],
    ]);
  });

  it("sends one change per item with the item's version, v0 when it has no listing yet", () => {
    const before = optionRowsOf(product, library, listings);
    const rows = [{ ...before[0]!, price: "11000" }, { ...before[1]!, price: "" }];
    expect(optionChanges(before, rows)).toEqual([
      { optionItemId: "i-pearl", version: 0, extraPrice: 11000 },
      { optionItemId: "i-cheese", version: 2, extraPrice: null },
    ]);
    expect(optionChanges(before, before)).toEqual([]);
    expect(optionErrors([{ ...before[0]!, price: "x" }])).toEqual({ "i-pearl": "Nhập giá thêm, ví dụ 5.000, hoặc để trống để như món." });
  });

  it("rebases typed prices on newer listings", () => {
    const before = optionRowsOf(product, library, listings);
    const typed = [{ ...before[0]!, price: "11.000" }, before[1]!];
    const after = optionRowsOf(product, library, [{ ...listings[0]!, extraPrice: 16000, version: 3 }]);
    expect(rebaseOptionRows(typed, before, after).map((r) => [nbsp(r.price), r.version])).toEqual([
      ["11.000", 0],
      ["16.000 ₫", 3],
    ]);
  });
});
