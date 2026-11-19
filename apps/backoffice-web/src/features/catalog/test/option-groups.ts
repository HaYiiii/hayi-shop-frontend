import { json } from "../../../test/fake-api";
import type { OptionGroup, OptionItem } from "../api/option-groups";

const item = (optionItemId: string, code: string, name: string, defaultExtraPrice: number, sortOrder: number): OptionItem => ({
  optionItemId,
  code,
  name,
  defaultExtraPrice,
  isDefaultSelected: false,
  status: "ACTIVE",
  sortOrder,
});

/** Topping (MULTIPLE, 0..3, v7): Trân châu 10.000, Thạch matcha 8.000, and an archived Pudding. */
export function aGroup(overrides: Partial<OptionGroup> = {}, options: { jellyDefault?: boolean } = {}): OptionGroup {
  return {
    optionGroupId: "g-topping",
    code: "TOPPING",
    name: "Topping",
    selectionType: "MULTIPLE",
    minSelect: 0,
    maxSelect: 3,
    status: "ACTIVE",
    createdAt: "2026-11-01T03:00:00Z",
    updatedAt: "2026-11-01T03:00:00Z",
    version: 7,
    items: [
      item("i-pearl", "TRAN-CHAU", "Trân châu", 10000, 1),
      { ...item("i-jelly", "THACH-MATCHA", "Thạch matcha", 8000, 2), isDefaultSelected: options.jellyDefault ?? false },
      { ...item("i-old", "PUDDING", "Pudding", 5000, 3), status: "ARCHIVED" },
    ],
    ...overrides,
  };
}

/** Mức đường (SINGLE, 1..1): 100% (default), 50%. */
export function aSugarGroup(overrides: Partial<OptionGroup> = {}): OptionGroup {
  return {
    ...aGroup(),
    optionGroupId: "g-sugar",
    code: "SUGAR",
    name: "Mức đường",
    selectionType: "SINGLE",
    minSelect: 1,
    maxSelect: 1,
    version: 2,
    items: [{ ...item("i-s100", "S100", "100%", 0, 1), isDefaultSelected: true }, item("i-s50", "S50", "50%", 0, 2)],
    ...overrides,
  };
}

/** An option group response with its `ETag` (API README §8). */
export function groupResponse(group: OptionGroup, status = 200) {
  const response = json(group, status);
  response.headers.set("ETag", `"v${group.version}"`);
  return response;
}
