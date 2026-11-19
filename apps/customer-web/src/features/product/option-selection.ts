import type { PublicComponents } from "@hayi/api-client";

type Schemas = PublicComponents["schemas"];
export type ProductDetail = Schemas["PublicProductDetail"];
export type DetailVariant = Schemas["DetailVariant"];
export type DetailOptionGroup = Schemas["DetailOptionGroup"];
export type DetailOptionItem = Schemas["DetailOptionItem"];

/** What the customer picked on the product page (D3a screen 3): a size and items per group. */
export interface Selection {
  variantId: string | null;
  items: Record<string, string[]>;
}

const orderable = (availability: Schemas["MenuAvailability"]) => availability === "AVAILABLE";

/**
 * The defaults that can be ordered (API 02 §2.2): the default size and the default items. A default that is
 * sold out stays unpicked — the page never picks another in its place (Decision F); the customer chooses.
 */
export function initialSelection(product: ProductDetail): Selection {
  const size = product.variants.find((v) => v.isDefault && orderable(v.availability));
  const items: Record<string, string[]> = {};
  for (const group of product.optionGroups) {
    const picked = group.items.filter((i) => i.isDefaultSelected && orderable(i.availability)).map((i) => i.optionItemId);
    items[group.optionGroupId] = picked.slice(0, group.maxSelect);
  }
  return { variantId: size?.variantId ?? null, items };
}

export function chooseVariant(selection: Selection, variant: DetailVariant): Selection {
  if (!orderable(variant.availability)) return selection;
  return { ...selection, variantId: variant.variantId };
}

const pickedIn = (selection: Selection, group: DetailOptionGroup) => selection.items[group.optionGroupId] ?? [];

/** Whether the item can be picked now: orderable, and the group has room (or it is a single choice, which swaps). */
export function canPick(selection: Selection, group: DetailOptionGroup, item: DetailOptionItem): boolean {
  const picked = pickedIn(selection, group);
  if (picked.includes(item.optionItemId)) return true;
  if (!orderable(item.availability)) return false;
  return group.selectionType === "SINGLE" || picked.length < group.maxSelect;
}

/**
 * Picks or unpicks an item within the group's min/max (AB3): a single choice swaps; an optional single choice
 * can be cleared; a multiple choice stops at max.
 */
export function toggleItem(selection: Selection, group: DetailOptionGroup, item: DetailOptionItem): Selection {
  const picked = pickedIn(selection, group);
  const id = item.optionItemId;
  let next: string[];
  if (picked.includes(id)) {
    if (group.selectionType === "SINGLE" && group.minSelect > 0) return selection;
    next = picked.filter((p) => p !== id);
  } else if (!canPick(selection, group, item)) {
    return selection;
  } else {
    next = group.selectionType === "SINGLE" ? [id] : [...picked, id];
  }
  return { ...selection, items: { ...selection.items, [group.optionGroupId]: next } };
}

/** What is still missing before the choice is complete: the size, and required groups below their minimum. */
export type Missing = { kind: "size" } | { kind: "group"; optionGroupId: string; name: string; need: number };

export function missing(product: ProductDetail, selection: Selection): Missing[] {
  const result: Missing[] = [];
  if (product.variants.length > 0 && selection.variantId === null) result.push({ kind: "size" });
  for (const group of product.optionGroups) {
    const need = group.minSelect - pickedIn(selection, group).length;
    if (need > 0) result.push({ kind: "group", optionGroupId: group.optionGroupId, name: group.name, need });
  }
  return result;
}

/** "Bắt buộc · chọn 1", "Chọn tối đa 3", "Tuỳ chọn" (D3a screen 3 legend). */
export function ruleText(group: DetailOptionGroup): string {
  const { minSelect: min, maxSelect: max } = group;
  if (min > 0) return min === max ? `Bắt buộc · chọn ${min}` : `Bắt buộc · chọn ${min}–${max}`;
  return max === 1 ? "Tuỳ chọn" : `Tuỳ chọn · tối đa ${max}`;
}

/** Why an item or a size cannot be picked (API 02 §2); `null` when it can. */
export function unavailableText(availability: Schemas["MenuAvailability"]): string | null {
  switch (availability) {
    case "AVAILABLE":
      return null;
    case "SOLD_OUT":
      return "tạm hết";
    case "PAUSED":
      return "tạm ngưng";
    case "OUTSIDE_SELLING_HOURS":
      return "ngoài giờ bán";
  }
}
