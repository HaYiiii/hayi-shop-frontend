import { describe, expect, it } from "vitest";
import { canPick, chooseVariant, initialSelection, missing, ruleText, toggleItem } from "./option-selection";
import { aProductDetail, group, item } from "./test/product";

const product = aProductDetail();
const [milk, sweet, extra] = product.optionGroups as [never, never, never];

describe("initialSelection", () => {
  it("picks the default size and default items that can be ordered", () => {
    expect(initialSelection(product)).toEqual({ variantId: "v-m", items: { "g-milk": ["i-fresh"], "g-sweet": [], "g-extra": [] } });
  });

  it("never picks another in place of a sold-out default (Decision F)", () => {
    const soldOut = aProductDetail({
      variants: [
        { variantId: "v-m", name: "M", price: 55000, isDefault: true, availability: "SOLD_OUT" },
        { variantId: "v-l", name: "L", price: 65000, isDefault: false, availability: "AVAILABLE" },
      ],
      optionGroups: [group("g-milk", "Loại sữa", { items: [item("i-fresh", "Sữa tươi", 0, { isDefaultSelected: true, availability: "SOLD_OUT" }), item("i-oat", "Yến mạch")] })],
    });
    expect(initialSelection(soldOut)).toEqual({ variantId: null, items: { "g-milk": [] } });
    expect(missing(soldOut, initialSelection(soldOut))).toEqual([
      { kind: "size" },
      { kind: "group", optionGroupId: "g-milk", name: "Loại sữa", need: 1 },
    ]);
  });
});

describe("choosing", () => {
  it("chooses an orderable size only", () => {
    const start = initialSelection(product);
    expect(chooseVariant(start, product.variants[1]!)).toBe(start);
  });

  it("a single choice swaps; a required one cannot be cleared, an optional one can", () => {
    let sel = initialSelection(product);
    expect(toggleItem(sel, milk, item("i-fresh", "Sữa tươi"))).toBe(sel);
    expect(toggleItem(sel, milk, item("i-oat", "Sữa yến mạch", 10000, { availability: "SOLD_OUT" }))).toBe(sel);
    sel = toggleItem(sel, sweet, item("i-70", "70%"));
    sel = toggleItem(sel, sweet, item("i-0", "Không đường"));
    expect(sel.items["g-sweet"]).toEqual(["i-0"]);
    sel = toggleItem(sel, sweet, item("i-0", "Không đường"));
    expect(sel.items["g-sweet"]).toEqual([]);
  });

  it("a multiple choice stops at max; the rest cannot be picked until one is removed", () => {
    let sel = initialSelection(product);
    sel = toggleItem(sel, extra, item("i-shot", "Shot", 10000));
    sel = toggleItem(sel, extra, item("i-cream", "Kem", 8000));
    expect(canPick(sel, extra, item("i-pearl", "Trân châu", 6000))).toBe(false);
    expect(toggleItem(sel, extra, item("i-pearl", "Trân châu", 6000)).items["g-extra"]).toEqual(["i-shot", "i-cream"]);
    sel = toggleItem(sel, extra, item("i-shot", "Shot", 10000));
    expect(canPick(sel, extra, item("i-pearl", "Trân châu", 6000))).toBe(true);
  });
});

describe("ruleText", () => {
  it("says what each group needs", () => {
    expect(ruleText(milk)).toBe("Bắt buộc · chọn 1");
    expect(ruleText(sweet)).toBe("Tuỳ chọn");
    expect(ruleText(extra)).toBe("Tuỳ chọn · tối đa 2");
    expect(ruleText(group("g", "x", { selectionType: "MULTIPLE", minSelect: 1, maxSelect: 3 }))).toBe("Bắt buộc · chọn 1–3");
  });
});
