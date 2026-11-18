import { ApiError } from "@hayi/api-client";
import { describe, expect, it } from "vitest";
import type { OptionGroup } from "./api/option-groups";
import {
  type GroupDraft,
  addItem,
  createBody,
  draftOf,
  emptyGroupDraft,
  localErrors,
  rebase,
  savePlan,
  serverErrors,
  setSelectionType,
  toggleDefault,
} from "./option-form";
import { aGroup } from "./test/option-groups";

let n = 0;
const key = () => `k${++n}`;

function problem(code: string, status: number, errors?: { field: string; message?: string }[]) {
  return new ApiError({ status, code, ...(errors && { errors: errors.map((e) => ({ code, ...e })) }) });
}

/** A new-group draft with two valid items. */
function aNewDraft(overrides: Partial<GroupDraft> = {}): GroupDraft {
  let draft = emptyGroupDraft();
  draft = { ...draft, code: "topping", name: "Topping", selectionType: "MULTIPLE", minSelect: "0", maxSelect: "3" };
  draft = addItem(draft, "a");
  draft = addItem(draft, "b");
  draft.items[0] = { ...draft.items[0]!, code: "tran-chau", name: "Trân châu", price: "10.000 ₫" };
  draft.items[1] = { ...draft.items[1]!, code: "THACH", name: "Thạch", price: "0", isDefaultSelected: true };
  return { ...draft, ...overrides };
}

describe("draftOf / emptyGroupDraft", () => {
  it("starts a new group as single choice, 0..1, without items", () => {
    expect(emptyGroupDraft()).toEqual({ code: "", name: "", selectionType: "SINGLE", minSelect: "0", maxSelect: "1", items: [] });
  });

  it("copies a group, items in order, archived ones included", () => {
    const draft = draftOf(aGroup(), key);
    expect(draft).toMatchObject({ code: "TOPPING", name: "Topping", selectionType: "MULTIPLE", minSelect: "0", maxSelect: "3" });
    expect(draft.items.map((i) => [i.optionItemId, i.name, i.price.replace(/\s/g, " "), i.status])).toEqual([
      ["i-pearl", "Trân châu", "10.000 ₫", "ACTIVE"],
      ["i-jelly", "Thạch matcha", "8.000 ₫", "ACTIVE"],
      ["i-old", "Pudding", "5.000 ₫", "ARCHIVED"],
    ]);
  });
});

describe("setSelectionType / toggleDefault", () => {
  it("single choice means at most one, and one default", () => {
    let draft = draftOf(aGroup(), key);
    draft = toggleDefault(draft, draft.items[0]!.key);
    draft = toggleDefault(draft, draft.items[1]!.key);
    expect(draft.items.filter((i) => i.isDefaultSelected)).toHaveLength(2);
    draft = setSelectionType(draft, "SINGLE");
    expect(draft.maxSelect).toBe("1");
    expect(draft.items.filter((i) => i.isDefaultSelected).map((i) => i.name)).toEqual(["Trân châu"]);
    draft = toggleDefault(draft, draft.items[1]!.key);
    expect(draft.items.filter((i) => i.isDefaultSelected).map((i) => i.name)).toEqual(["Thạch matcha"]);
  });
});

describe("localErrors", () => {
  it("accepts a valid new group", () => {
    expect(localErrors(aNewDraft(), true)).toEqual({});
  });

  it("checks code, name, min/max and items like the server (Decision AB1, AB3)", () => {
    const draft = aNewDraft({ code: "", name: " ", minSelect: "4", maxSelect: "3" });
    draft.items[1] = { ...draft.items[1]!, code: "tran-chau", name: "", price: "-1" };
    expect(localErrors(draft, true)).toEqual({
      code: "Nhập mã nhóm, ví dụ TOPPING.",
      name: "Nhập tên nhóm.",
      maxSelect: "Tối đa phải lớn hơn hoặc bằng tối thiểu (4).",
      "items[1].code": "Mã trùng với lựa chọn 1.",
      "items[1].name": "Nhập tên lựa chọn.",
      "items[1].defaultExtraPrice": "Nhập giá thêm, ví dụ 5.000 hoặc 0.",
    });
  });

  it("asks for whole numbers, max ≥ 1, max 1 for single choice, defaults ≤ max", () => {
    expect(localErrors(aNewDraft({ minSelect: "a", maxSelect: "0" }), true)).toEqual({
      minSelect: "Nhập số nguyên từ 0.",
      maxSelect: "Nhập số nguyên từ 1.",
    });
    expect(localErrors(aNewDraft({ selectionType: "SINGLE", maxSelect: "2" }), true)).toEqual({
      maxSelect: "Nhóm chọn một thì tối đa là 1.",
    });
    const defaults = aNewDraft({ maxSelect: "1" });
    defaults.items[0] = { ...defaults.items[0]!, isDefaultSelected: true };
    expect(localErrors(defaults, true)).toEqual({ maxSelect: "Có 2 lựa chọn chọn sẵn, nhiều hơn tối đa (1)." });
  });

  it("does not check codes of existing items nor archived rows", () => {
    const draft = draftOf(aGroup(), key);
    draft.items[2] = { ...draft.items[2]!, name: "" };
    expect(localErrors(draft, false)).toEqual({});
  });
});

describe("createBody", () => {
  it("upper-cases codes, parses min/max and prices", () => {
    expect(createBody(aNewDraft())).toEqual({
      code: "TOPPING",
      name: "Topping",
      selectionType: "MULTIPLE",
      minSelect: 0,
      maxSelect: 3,
      items: [
        { code: "TRAN-CHAU", name: "Trân châu", defaultExtraPrice: 10000, isDefaultSelected: false },
        { code: "THACH", name: "Thạch", defaultExtraPrice: 0, isDefaultSelected: true },
      ],
    });
  });
});

describe("savePlan", () => {
  it("has nothing to do for an unchanged group", () => {
    const group = aGroup();
    expect(savePlan(group, draftOf(group, key))).toEqual([]);
  });

  it("clears defaults first, then the group, then item edits, then new items", () => {
    const group = aGroup({ maxSelect: 3 }, { jellyDefault: true });
    let draft = draftOf(group, key);
    draft = { ...draft, name: "Topping thêm", maxSelect: "1" };
    draft = toggleDefault(draft, draft.items[1]!.key); // jelly off
    draft = toggleDefault(draft, draft.items[0]!.key); // pearl on
    draft.items[0] = { ...draft.items[0]!, price: "12000" };
    draft = addItem(draft, "new");
    draft.items[3] = { ...draft.items[3]!, code: "kem", name: "Kem cheese", price: "15.000" };

    expect(savePlan(group, draft)).toEqual([
      { kind: "item", index: 1, optionItemId: "i-jelly", body: { isDefaultSelected: false } },
      { kind: "group", body: { name: "Topping thêm", maxSelect: 1 } },
      { kind: "item", index: 0, optionItemId: "i-pearl", body: { defaultExtraPrice: 12000, isDefaultSelected: true } },
      { kind: "add", index: 3, body: { code: "KEM", name: "Kem cheese", defaultExtraPrice: 15000, isDefaultSelected: false } },
    ]);
  });
});

describe("rebase", () => {
  it("takes the new version's values where the user typed nothing, and keeps what they typed", () => {
    const before = aGroup();
    let draft = draftOf(before, key);
    draft = { ...draft, name: "Topping của tôi" };
    draft.items[1] = { ...draft.items[1]!, price: "9.000" };
    draft = addItem(draft, "new");
    const after: OptionGroup = {
      ...aGroup({ minSelect: 1, version: 8 }),
      items: aGroup().items.map((i) => (i.optionItemId === "i-pearl" ? { ...i, name: "Trân châu đen", status: "ARCHIVED" as const } : i)),
    };

    const next = rebase(draft, before, after, key);
    expect(next).toMatchObject({ name: "Topping của tôi", minSelect: "1" });
    expect(next.items.map((i) => [i.name, i.price.replace(/\s/g, " "), i.status])).toEqual([
      ["Trân châu đen", "10.000 ₫", "ARCHIVED"],
      ["Thạch matcha", "9.000", "ACTIVE"],
      ["Pudding", "5.000 ₫", "ARCHIVED"],
      ["", "", "ACTIVE"],
    ]);
  });
});

describe("serverErrors", () => {
  const draft = aNewDraft();

  it("puts min/max problems on the max field", () => {
    expect(serverErrors(problem("OPTION_GROUP_MINMAX_INVALID", 422), draft, { kind: "group" })).toEqual({
      maxSelect: "Tối thiểu, tối đa và số lựa chọn chọn sẵn chưa khớp: tối thiểu ≤ tối đa, chọn một thì tối đa là 1, chọn sẵn không quá tối đa.",
    });
  });

  it("puts a taken code on the group when creating, on the item when adding", () => {
    expect(serverErrors(problem("CATALOG_CODE_TAKEN", 409), draft, { kind: "create" })).toEqual({
      code: "Mã nhóm này đã được dùng, kể cả bởi nhóm đã lưu trữ. Đặt mã khác.",
    });
    expect(serverErrors(problem("CATALOG_CODE_TAKEN", 409), draft, { kind: "add", index: 1 })).toEqual({
      "items[1].code": "Mã này đã có trong nhóm, kể cả lựa chọn đã lưu trữ. Đặt mã khác.",
    });
  });

  it("maps item fields of a create, and bare fields of one item", () => {
    expect(
      serverErrors(problem("CATALOG_PRICE_NEGATIVE", 422, [{ field: "items[1].defaultExtraPrice" }]), draft, { kind: "create" }),
    ).toEqual({ "items[1].defaultExtraPrice": "Giá thêm không được âm." });
    expect(
      serverErrors(problem("VALIDATION_FAILED", 400, [{ field: "name", message: "Quá dài" }]), draft, { kind: "item", index: 0 }),
    ).toEqual({ "items[0].name": "Quá dài" });
  });

  it("returns nothing for other errors", () => {
    expect(serverErrors(problem("VERSION_CONFLICT", 412), draft, { kind: "group" })).toEqual({});
  });
});
