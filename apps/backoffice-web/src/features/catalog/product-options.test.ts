import { ApiError } from "@hayi/api-client";
import { formatVnd } from "@hayi/domain-utils";
import { describe, expect, it } from "vitest";
import type { Product } from "./api/products";
import {
  attachGroup,
  detachGroup,
  groupWarning,
  groupsBody,
  groupsChanged,
  isOptionsEdited,
  localErrors,
  moveGroup,
  optionsEditorOf,
  overridesBody,
  overridesChanged,
  serverErrors,
  setItem,
  setLimits,
} from "./product-options";
import { aGroup, aSugarGroup } from "./test/option-groups";
import { aProduct } from "./test/products";

const library = [aGroup(), aSugarGroup()];

const attached = (overrides: Partial<Product> = {}) =>
  aProduct({
    optionGroups: [
      { ...pog("g-sugar", "SUGAR", "Mức đường", "SINGLE", 1, 1), sortOrder: 0 },
      { ...pog("g-topping", "TOPPING", "Topping", "MULTIPLE", 0, 3), maxSelectOverride: 2, maxSelect: 2, sortOrder: 1 },
    ],
    optionItemOverrides: [{ optionItemId: "i-pearl", extraPriceOverride: 12000, isHidden: false }],
    ...overrides,
  });

function pog(optionGroupId: string, code: string, name: string, selectionType: "SINGLE" | "MULTIPLE", minSelect: number, maxSelect: number) {
  return { optionGroupId, code, name, selectionType, minSelect, maxSelect, minSelectOverride: null, maxSelectOverride: null, sortOrder: 0 };
}

describe("optionsEditorOf", () => {
  it("holds the attached groups in order with their overrides, and item settings", () => {
    const editor = optionsEditorOf(attached());
    expect(editor.groups).toEqual([
      { optionGroupId: "g-sugar", min: "", max: "" },
      { optionGroupId: "g-topping", min: "", max: "2" },
    ]);
    expect(editor.items).toEqual({ "i-pearl": { price: formatVnd(12000), hidden: false } });
    expect(isOptionsEdited(editor, attached())).toBe(false);
  });
});

describe("attach / detach / move / limits", () => {
  it("attaches a group last once, moves it, detaches it", () => {
    let editor = optionsEditorOf(aProduct());
    editor = attachGroup(attachGroup(editor, "g-topping"), "g-sugar");
    expect(attachGroup(editor, "g-sugar")).toBe(editor);
    editor = moveGroup(editor, "g-sugar", -1);
    expect(editor.groups.map((g) => g.optionGroupId)).toEqual(["g-sugar", "g-topping"]);
    expect(moveGroup(editor, "g-sugar", -1)).toBe(editor);
    editor = detachGroup(editor, "g-sugar");
    expect(editor.groups.map((g) => g.optionGroupId)).toEqual(["g-topping"]);
  });

  it("an item setting back to the default counts as unchanged", () => {
    let editor = setItem(optionsEditorOf(attached()), "i-jelly", { hidden: true });
    expect(isOptionsEdited(editor, attached())).toBe(true);
    editor = setItem(editor, "i-jelly", { hidden: false });
    expect(isOptionsEdited(editor, attached())).toBe(false);
  });
});

describe("localErrors", () => {
  it("checks effective min/max per group (AB3, AC2) and override prices", () => {
    let editor = optionsEditorOf(attached());
    editor = setLimits(editor, "g-topping", { min: "3", max: "2" });
    editor = setItem(editor, "i-jelly", { price: "abc" });
    expect(localErrors(editor, library)).toEqual({
      "groups[1].max": "Tối đa phải lớn hơn hoặc bằng tối thiểu (3).",
      "items.i-jelly.price": "Nhập giá thêm, ví dụ 5.000, hoặc để trống để theo nhóm.",
    });
    expect(localErrors(setLimits(editor, "g-topping", { min: "x", max: "0" }), library)).toMatchObject({
      "groups[1].min": "Nhập số nguyên từ 0, hoặc để trống.",
      "groups[1].max": "Nhập số nguyên từ 1, hoặc để trống.",
    });
  });

  it("asks to remove a group archived in the library", () => {
    const archived = [aGroup({ status: "ARCHIVED" }), aSugarGroup()];
    expect(localErrors(optionsEditorOf(attached()), archived)).toEqual({
      "groups[1].group": "Nhóm này đã lưu trữ ở thư viện. Gỡ khỏi món để lưu.",
    });
  });
});

describe("groupWarning (W4, not blocking)", () => {
  it("warns when max is above the items still shown", () => {
    const editor = optionsEditorOf(attached());
    const row = editor.groups[1]!;
    expect(groupWarning(aGroup(), row, editor)).toBeNull();
    const hidden = setItem(editor, "i-jelly", { hidden: true });
    expect(groupWarning(aGroup(), row, hidden)).toBe(
      "Tối đa 2 lớn hơn số lựa chọn đang hiện (1). Món sẽ chưa kích hoạt được cho tới khi giảm tối đa hoặc hiện lại lựa chọn.",
    );
  });
});

describe("request bodies", () => {
  it("sends groups in order with null for 'as the group'", () => {
    const editor = moveGroup(setLimits(optionsEditorOf(attached()), "g-topping", { max: "" }), "g-topping", -1);
    expect(groupsBody(editor)).toEqual({
      groups: [
        { optionGroupId: "g-topping", minSelectOverride: null, maxSelectOverride: null },
        { optionGroupId: "g-sugar", minSelectOverride: null, maxSelectOverride: null },
      ],
    });
    expect(groupsChanged(attached(), editor)).toBe(true);
    expect(groupsChanged(attached(), optionsEditorOf(attached()))).toBe(false);
  });

  it("sends only hidden or priced items of attached groups, in library order", () => {
    let editor = optionsEditorOf(attached());
    editor = setItem(editor, "i-jelly", { hidden: true });
    editor = setItem(editor, "i-s50", { price: "2000" });
    expect(overridesBody(editor, library)).toEqual({
      overrides: [
        { optionItemId: "i-s50", extraPriceOverride: 2000, isHidden: false },
        { optionItemId: "i-pearl", extraPriceOverride: 12000, isHidden: false },
        { optionItemId: "i-jelly", extraPriceOverride: null, isHidden: true },
      ],
    });
    expect(overridesChanged(attached(), editor, library)).toBe(true);
    // A removed group takes its item settings with it.
    expect(overridesBody(detachGroup(editor, "g-topping"), library)).toEqual({
      overrides: [{ optionItemId: "i-s50", extraPriceOverride: 2000, isHidden: false }],
    });
  });
});

describe("serverErrors", () => {
  it("puts CATALOG_PRICE_NEGATIVE on the item of the sent override", () => {
    const sent = { overrides: [{ optionItemId: "i-pearl", extraPriceOverride: -1, isHidden: false }] };
    const error = new ApiError({
      status: 422,
      code: "CATALOG_PRICE_NEGATIVE",
      errors: [{ field: "overrides[0].extraPriceOverride", code: "MIN" }],
    });
    expect(serverErrors(error, sent)).toEqual({ "items.i-pearl.price": "Giá thêm không được âm." });
  });
});
