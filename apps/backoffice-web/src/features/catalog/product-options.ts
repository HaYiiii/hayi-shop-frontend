import { ApiError, type BackofficeComponents } from "@hayi/api-client";
import { formatVnd } from "@hayi/domain-utils";
import type { OptionGroup, OptionItem } from "./api/option-groups";
import type { Product } from "./api/products";
import { parsePrice } from "./product-form";

type Schemas = BackofficeComponents["schemas"];
export type GroupsBody = Schemas["ProductOptionGroupsReplaceRequest"];
export type OverridesBody = Schemas["ProductOptionItemOverridesReplaceRequest"];

/** Groups a Product can carry (Decision AC2). */
export const GROUPS_MAX = 20;

/** One attached group as typed; `min`/`max` `""` = as the group (no override). */
export interface AttachedGroup {
  optionGroupId: string;
  min: string;
  max: string;
}

/** One item's override as typed; `price` `""` = the library price. */
export interface ItemSetting {
  price: string;
  hidden: boolean;
}

/** What tab "Tuỳ chọn" holds (D3d screen 24): groups in the order customers see them, item settings by item id. */
export interface OptionsEditor {
  groups: AttachedGroup[];
  items: Record<string, ItemSetting>;
}

export type OptionsFieldPath = `groups[${number}].${"min" | "max" | "group"}` | `items.${string}.price`;
export type OptionsFieldErrors = Partial<Record<OptionsFieldPath, string>>;

const overrideText = (value: number | null) => (value === null ? "" : String(value));

export function optionsEditorOf(product: Product): OptionsEditor {
  const items: Record<string, ItemSetting> = {};
  for (const o of product.optionItemOverrides) {
    items[o.optionItemId] = { price: o.extraPriceOverride === null ? "" : formatVnd(o.extraPriceOverride), hidden: o.isHidden };
  }
  return {
    groups: [...product.optionGroups]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((g) => ({ optionGroupId: g.optionGroupId, min: overrideText(g.minSelectOverride), max: overrideText(g.maxSelectOverride) })),
    items,
  };
}

export function isOptionsEdited(editor: OptionsEditor, product: Product): boolean {
  return JSON.stringify(normalise(editor)) !== JSON.stringify(normalise(optionsEditorOf(product)));
}

/** Two versions differ only in what this tab does not edit. */
export function sameOptions(a: Product, b: Product): boolean {
  return !isOptionsEdited(optionsEditorOf(a), b);
}

/** Item settings that equal the default (shown, library price) carry nothing. */
function normalise(editor: OptionsEditor): OptionsEditor {
  const items = Object.fromEntries(
    Object.entries(editor.items)
      .filter(([, s]) => s.hidden || s.price.trim() !== "")
      .sort(([a], [b]) => a.localeCompare(b)),
  );
  return { groups: editor.groups, items };
}

/**
 * The editor on top of a newer version (after "Tải lại"): the group list takes the new one unless the
 * user changed it; each item setting takes the new one unless the user changed that item.
 */
export function rebaseOptions(editor: OptionsEditor, before: Product, after: Product): OptionsEditor {
  const old = optionsEditorOf(before);
  const fresh = optionsEditorOf(after);
  const groups = JSON.stringify(editor.groups) === JSON.stringify(old.groups) ? fresh.groups : editor.groups;
  const none: ItemSetting = { price: "", hidden: false };
  const same = (a: ItemSetting | undefined, b: ItemSetting | undefined) => JSON.stringify(a ?? none) === JSON.stringify(b ?? none);
  const items: Record<string, ItemSetting> = {};
  for (const id of new Set([...Object.keys(editor.items), ...Object.keys(old.items), ...Object.keys(fresh.items)])) {
    const pick = same(editor.items[id], old.items[id]) ? fresh.items[id] : editor.items[id];
    if (pick) items[id] = pick;
  }
  return { groups, items };
}

export function attachGroup(editor: OptionsEditor, optionGroupId: string): OptionsEditor {
  if (editor.groups.length >= GROUPS_MAX || editor.groups.some((g) => g.optionGroupId === optionGroupId)) return editor;
  return { ...editor, groups: [...editor.groups, { optionGroupId, min: "", max: "" }] };
}

export function detachGroup(editor: OptionsEditor, optionGroupId: string): OptionsEditor {
  return { ...editor, groups: editor.groups.filter((g) => g.optionGroupId !== optionGroupId) };
}

/** Moves a group one place up (`-1`) or down (`1`) in the order customers see. */
export function moveGroup(editor: OptionsEditor, optionGroupId: string, by: -1 | 1): OptionsEditor {
  const from = editor.groups.findIndex((g) => g.optionGroupId === optionGroupId);
  const to = from + by;
  if (from < 0 || to < 0 || to >= editor.groups.length) return editor;
  const groups = [...editor.groups];
  [groups[from], groups[to]] = [groups[to]!, groups[from]!];
  return { ...editor, groups };
}

export function setLimits(editor: OptionsEditor, optionGroupId: string, change: Partial<Pick<AttachedGroup, "min" | "max">>): OptionsEditor {
  return { ...editor, groups: editor.groups.map((g) => (g.optionGroupId === optionGroupId ? { ...g, ...change } : g)) };
}

export function setItem(editor: OptionsEditor, optionItemId: string, change: Partial<ItemSetting>): OptionsEditor {
  const current = editor.items[optionItemId] ?? { price: "", hidden: false };
  return { ...editor, items: { ...editor.items, [optionItemId]: { ...current, ...change } } };
}

function wholeNumber(text: string): number | null {
  const trimmed = text.trim();
  return /^\d+$/.test(trimmed) ? Number(trimmed) : null;
}

/** The items a customer can pick in this Product: active in the library, not hidden here. */
export function visibleItems(group: OptionGroup, editor: OptionsEditor): OptionItem[] {
  return group.items.filter((i) => i.status === "ACTIVE" && !editor.items[i.optionItemId]?.hidden);
}

/** Min/max in force: the override when typed, else the group's (Decision AC2). */
export function effectiveLimits(group: OptionGroup, row: AttachedGroup): { min: number | null; max: number | null } {
  return {
    min: row.min.trim() === "" ? group.minSelect : wholeNumber(row.min),
    max: row.max.trim() === "" ? group.maxSelect : wholeNumber(row.max),
  };
}

/**
 * Checks the server makes on `PUT` (Decisions AB3, AC2, AC3), shown at the group before sending:
 * effective min/max, archived groups, override prices.
 */
export function localErrors(editor: OptionsEditor, library: readonly OptionGroup[]): OptionsFieldErrors {
  const errors: OptionsFieldErrors = {};
  const byId = new Map(library.map((g) => [g.optionGroupId, g]));
  editor.groups.forEach((row, i) => {
    const group = byId.get(row.optionGroupId);
    if (!group) return;
    if (group.status !== "ACTIVE") {
      errors[`groups[${i}].group`] = "Nhóm này đã lưu trữ ở thư viện. Gỡ khỏi món để lưu.";
      return;
    }
    if (row.min.trim() !== "" && wholeNumber(row.min) === null) errors[`groups[${i}].min`] = "Nhập số nguyên từ 0, hoặc để trống.";
    if (row.max.trim() !== "" && (wholeNumber(row.max) ?? 0) < 1) errors[`groups[${i}].max`] = "Nhập số nguyên từ 1, hoặc để trống.";
    if (errors[`groups[${i}].min`] || errors[`groups[${i}].max`]) return;
    const { min, max } = effectiveLimits(group, row);
    if (min !== null && max !== null && max < min) errors[`groups[${i}].max`] = `Tối đa phải lớn hơn hoặc bằng tối thiểu (${min}).`;
    else if (group.selectionType === "SINGLE" && max !== 1) errors[`groups[${i}].max`] = "Nhóm chọn một thì tối đa là 1.";
    else {
      const defaults = group.items.filter((it) => it.status === "ACTIVE" && it.isDefaultSelected).length;
      if (max !== null && defaults > max) errors[`groups[${i}].max`] = `Nhóm có ${defaults} lựa chọn chọn sẵn, nhiều hơn tối đa (${max}).`;
    }
    for (const item of group.items) {
      const setting = editor.items[item.optionItemId];
      if (item.status === "ACTIVE" && setting && setting.price.trim() !== "" && parsePrice(setting.price) === null) {
        errors[`items.${item.optionItemId}.price`] = "Nhập giá thêm, ví dụ 5.000, hoặc để trống để theo nhóm.";
      }
    }
  });
  return errors;
}

/**
 * Not a save blocker (agreed 2026-11-19): W4 is checked at activation. A group whose max (or min) is
 * above the items still shown makes the Product impossible to activate (Decision AC4).
 */
export function groupWarning(group: OptionGroup, row: AttachedGroup, editor: OptionsEditor): string | null {
  if (group.status !== "ACTIVE") return null;
  const { min, max } = effectiveLimits(group, row);
  const visible = visibleItems(group, editor).length;
  if (max !== null && max > visible) {
    return `Tối đa ${max} lớn hơn số lựa chọn đang hiện (${visible}). Món sẽ chưa kích hoạt được cho tới khi giảm tối đa hoặc hiện lại lựa chọn.`;
  }
  if (min !== null && min > visible) {
    return `Tối thiểu ${min} lớn hơn số lựa chọn đang hiện (${visible}). Món sẽ chưa kích hoạt được.`;
  }
  return null;
}

/** `PUT /products/{id}/option-groups`: every attached group in order; call only when `localErrors` is empty. */
export function groupsBody(editor: OptionsEditor): GroupsBody {
  return {
    groups: editor.groups.map((g) => ({
      optionGroupId: g.optionGroupId,
      minSelectOverride: g.min.trim() === "" ? null : wholeNumber(g.min),
      maxSelectOverride: g.max.trim() === "" ? null : wholeNumber(g.max),
    })),
  };
}

/** The same request as the Product holds it now, to send only what changed. */
export function currentGroupsBody(product: Product): GroupsBody {
  return {
    groups: [...product.optionGroups]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((g) => ({ optionGroupId: g.optionGroupId, minSelectOverride: g.minSelectOverride, maxSelectOverride: g.maxSelectOverride })),
  };
}

/**
 * `PUT /products/{id}/option-item-overrides`: the items of attached groups that are hidden or priced
 * here, in library order. Settings of removed groups go (the server drops them too, AC2).
 */
export function overridesBody(editor: OptionsEditor, library: readonly OptionGroup[]): OverridesBody {
  const byId = new Map(library.map((g) => [g.optionGroupId, g]));
  const overrides: OverridesBody["overrides"] = [];
  for (const row of editor.groups) {
    for (const item of byId.get(row.optionGroupId)?.items ?? []) {
      const setting = editor.items[item.optionItemId];
      if (!setting) continue;
      const price = setting.price.trim() === "" ? null : parsePrice(setting.price);
      if (!setting.hidden && price === null) continue;
      overrides.push({ optionItemId: item.optionItemId, extraPriceOverride: price, isHidden: setting.hidden });
    }
  }
  return { overrides };
}

export function currentOverridesBody(product: Product, library: readonly OptionGroup[]): OverridesBody {
  return overridesBody(optionsEditorOf(product), library);
}

const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Whether each `PUT` is needed for `editor` over `product`. The overrides step is judged again after the groups step. */
export function groupsChanged(product: Product, editor: OptionsEditor): boolean {
  return !sameJson(groupsBody(editor), currentGroupsBody(product));
}

export function overridesChanged(product: Product, editor: OptionsEditor, library: readonly OptionGroup[]): boolean {
  return !sameJson(overridesBody(editor, library), currentOverridesBody(product, library));
}

/** Price errors of `CATALOG_PRICE_NEGATIVE` (`errors[].field` = `overrides[i].extraPriceOverride`) at their item. */
export function serverErrors(error: unknown, sent: OverridesBody | null): OptionsFieldErrors {
  if (!(error instanceof ApiError) || error.code !== "CATALOG_PRICE_NEGATIVE" || !sent) return {};
  const result: OptionsFieldErrors = {};
  for (const e of error.problem.errors ?? []) {
    const match = /^overrides\[(\d+)\]\.extraPriceOverride$/.exec(e.field);
    const item = match ? sent.overrides[Number(match[1])] : undefined;
    if (item) result[`items.${item.optionItemId}.price`] = "Giá thêm không được âm.";
  }
  return result;
}

/** The id of a group's heading in tab "Tuỳ chọn", for "Sửa ngay" of `OPTION_CONFIG_INVALID` (screen 23). */
export const groupHeadingId = (optionGroupId: string) => `option-group-${optionGroupId}`;
