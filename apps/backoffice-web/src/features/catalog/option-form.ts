import { ApiError } from "@hayi/api-client";
import { formatVnd } from "@hayi/domain-utils";
import type {
  OptionGroup,
  OptionGroupCreateRequest,
  OptionGroupPatch,
  OptionItem,
  OptionItemInput,
  OptionItemPatch,
  OptionSelectionType,
  OptionStatus,
} from "./api/option-groups";
import { parsePrice } from "./product-form";

/** Limits of the option library (API 08 §1.5, Decision AB). */
export const CODE_MAX = 64;
export const NAME_MAX = 128;
export const ITEMS_MAX = 50;

const codePattern = /^[A-Za-z0-9][A-Za-z0-9-]{0,63}$/;

/** One item row as typed; `optionItemId` `null` = new, `price` is the input text. */
export interface ItemRow {
  key: string;
  optionItemId: string | null;
  code: string;
  name: string;
  price: string;
  isDefaultSelected: boolean;
  status: OptionStatus;
}

/** What the group form holds (D3d screen 27); min/max are the input texts. */
export interface GroupDraft {
  code: string;
  name: string;
  selectionType: OptionSelectionType;
  minSelect: string;
  maxSelect: string;
  items: ItemRow[];
}

export type GroupFieldPath =
  | "code"
  | "name"
  | "selectionType"
  | "minSelect"
  | "maxSelect"
  | `items[${number}].${"code" | "name" | "defaultExtraPrice"}`;
export type GroupFieldErrors = Partial<Record<GroupFieldPath, string>>;

const groupFields = ["code", "name", "selectionType", "minSelect", "maxSelect"] as const;
const itemFields = ["code", "name", "defaultExtraPrice"] as const;

/** Field paths in form order, for "focus the first error". */
export function fieldOrder(draft: GroupDraft): GroupFieldPath[] {
  return [...groupFields, ...draft.items.flatMap((_, i) => itemFields.map((f) => `items[${i}].${f}` as const))];
}

const priceText = (amount: number) => formatVnd(amount);

function rowOf(item: OptionItem, key: string): ItemRow {
  return {
    key,
    optionItemId: item.optionItemId,
    code: item.code,
    name: item.name,
    price: priceText(item.defaultExtraPrice),
    isDefaultSelected: item.isDefaultSelected,
    status: item.status,
  };
}

export function emptyGroupDraft(): GroupDraft {
  return { code: "", name: "", selectionType: "SINGLE", minSelect: "0", maxSelect: "1", items: [] };
}

/** The form for an existing group; items in their order, archived ones included (shown read-only). */
export function draftOf(group: OptionGroup, newKey: () => string): GroupDraft {
  return {
    code: group.code,
    name: group.name,
    selectionType: group.selectionType,
    minSelect: String(group.minSelect),
    maxSelect: String(group.maxSelect),
    items: [...group.items].sort((a, b) => a.sortOrder - b.sortOrder).map((item) => rowOf(item, newKey())),
  };
}

export function addItem(draft: GroupDraft, key: string): GroupDraft {
  if (draft.items.length >= ITEMS_MAX) return draft;
  const row: ItemRow = { key, optionItemId: null, code: "", name: "", price: "", isDefaultSelected: false, status: "ACTIVE" };
  return { ...draft, items: [...draft.items, row] };
}

/** A new row that was never saved can simply go. */
export function removeNewItem(draft: GroupDraft, key: string): GroupDraft {
  return { ...draft, items: draft.items.filter((i) => i.key !== key || i.optionItemId !== null) };
}

/** Single choice means max 1 and at most one default (the first one kept). */
export function setSelectionType(draft: GroupDraft, selectionType: OptionSelectionType): GroupDraft {
  if (selectionType === "MULTIPLE") return { ...draft, selectionType };
  let kept = false;
  const items = draft.items.map((item) => {
    if (!item.isDefaultSelected) return item;
    if (kept) return { ...item, isDefaultSelected: false };
    kept = true;
    return item;
  });
  return { ...draft, selectionType, maxSelect: "1", items };
}

/** Toggles "chọn sẵn"; with single choice, turning one on turns the others off. */
export function toggleDefault(draft: GroupDraft, key: string): GroupDraft {
  const single = draft.selectionType === "SINGLE";
  return {
    ...draft,
    items: draft.items.map((item) => {
      if (item.key === key) return { ...item, isDefaultSelected: !item.isDefaultSelected };
      return single ? { ...item, isDefaultSelected: false } : item;
    }),
  };
}

function wholeNumber(text: string): number | null {
  const trimmed = text.trim();
  return /^\d+$/.test(trimmed) ? Number(trimmed) : null;
}

const isActive = (row: ItemRow) => row.status === "ACTIVE";

/**
 * Checks the server would also make (API 08 §1.5, Decision AB1/AB3). `isNew`: the group code is typed;
 * for an existing group only new items have a code to check.
 */
export function localErrors(draft: GroupDraft, isNew: boolean): GroupFieldErrors {
  const errors: GroupFieldErrors = {};
  if (isNew) {
    const code = draft.code.trim();
    if (!code) errors.code = "Nhập mã nhóm, ví dụ TOPPING.";
    else if (!codePattern.test(code)) errors.code = "Chỉ dùng chữ, số và dấu gạch ngang, tối đa 64 ký tự.";
  }
  if (!draft.name.trim()) errors.name = "Nhập tên nhóm.";

  const min = wholeNumber(draft.minSelect);
  const max = wholeNumber(draft.maxSelect);
  if (min === null) errors.minSelect = "Nhập số nguyên từ 0.";
  if (max === null || max < 1) errors.maxSelect = "Nhập số nguyên từ 1.";
  else if (draft.selectionType === "SINGLE" && max !== 1) errors.maxSelect = "Nhóm chọn một thì tối đa là 1.";
  else if (min !== null && max < min) errors.maxSelect = `Tối đa phải lớn hơn hoặc bằng tối thiểu (${min}).`;
  else {
    const defaults = draft.items.filter((i) => isActive(i) && i.isDefaultSelected).length;
    if (defaults > max) errors.maxSelect = `Có ${defaults} lựa chọn chọn sẵn, nhiều hơn tối đa (${max}).`;
  }

  const seen = new Map<string, number>();
  for (const [i, row] of draft.items.entries()) {
    if (!isActive(row)) continue;
    const code = row.code.trim().toUpperCase();
    if (row.optionItemId === null) {
      if (!code) errors[`items[${i}].code`] = "Nhập mã lựa chọn.";
      else if (!codePattern.test(code)) errors[`items[${i}].code`] = "Chỉ dùng chữ, số và dấu gạch ngang.";
      else if (seen.has(code)) errors[`items[${i}].code`] = `Mã trùng với lựa chọn ${seen.get(code)! + 1}.`;
    }
    if (code && !seen.has(code)) seen.set(code, i);
    if (!row.name.trim()) errors[`items[${i}].name`] = "Nhập tên lựa chọn.";
    if (parsePrice(row.price) === null) errors[`items[${i}].defaultExtraPrice`] = "Nhập giá thêm, ví dụ 5.000 hoặc 0.";
  }
  return errors;
}

function itemInput(row: ItemRow): OptionItemInput {
  return {
    code: row.code.trim().toUpperCase(),
    name: row.name.trim(),
    defaultExtraPrice: parsePrice(row.price) ?? 0,
    isDefaultSelected: row.isDefaultSelected,
  };
}

/** `POST /option-groups` with its items; call only when `localErrors` is empty. */
export function createBody(draft: GroupDraft): OptionGroupCreateRequest {
  return {
    code: draft.code.trim().toUpperCase(),
    name: draft.name.trim(),
    selectionType: draft.selectionType,
    minSelect: wholeNumber(draft.minSelect) ?? 0,
    maxSelect: wholeNumber(draft.maxSelect) ?? 1,
    items: draft.items.filter(isActive).map(itemInput),
  };
}

/** One request of a save; `index` is the item row it belongs to. */
export type SaveStep =
  | { kind: "group"; body: OptionGroupPatch }
  | { kind: "item"; index: number; optionItemId: string; body: OptionItemPatch }
  | { kind: "add"; index: number; body: OptionItemInput };

/**
 * The requests that turn `group` into `draft`, in an order the server accepts at every step (each
 * one must keep defaults ≤ max, AB3): defaults turned off first, then the group, then the other
 * item edits, then new items. Each step answers the group with its new version (AB1).
 */
export function savePlan(group: OptionGroup, draft: GroupDraft): SaveStep[] {
  const groupBody: OptionGroupPatch = {};
  if (draft.name.trim() !== group.name) groupBody.name = draft.name.trim();
  if (draft.selectionType !== group.selectionType) groupBody.selectionType = draft.selectionType;
  const min = wholeNumber(draft.minSelect);
  const max = wholeNumber(draft.maxSelect);
  if (min !== null && min !== group.minSelect) groupBody.minSelect = min;
  if (max !== null && max !== group.maxSelect) groupBody.maxSelect = max;

  const byId = new Map(group.items.map((item) => [item.optionItemId, item]));
  const clearing: SaveStep[] = [];
  const editing: SaveStep[] = [];
  const adding: SaveStep[] = [];
  for (const [index, row] of draft.items.entries()) {
    if (!isActive(row)) continue;
    if (row.optionItemId === null) {
      adding.push({ kind: "add", index, body: itemInput(row) });
      continue;
    }
    const item = byId.get(row.optionItemId);
    if (!item || item.status !== "ACTIVE") continue;
    const body: OptionItemPatch = {};
    if (row.name.trim() !== item.name) body.name = row.name.trim();
    const price = parsePrice(row.price);
    if (price !== null && price !== item.defaultExtraPrice) body.defaultExtraPrice = price;
    if (row.isDefaultSelected !== item.isDefaultSelected) body.isDefaultSelected = row.isDefaultSelected;
    if (Object.keys(body).length === 0) continue;
    const step: SaveStep = { kind: "item", index, optionItemId: row.optionItemId, body };
    if (body.isDefaultSelected === false) {
      clearing.push(step);
    } else {
      editing.push(step);
    }
  }
  const groupStep: SaveStep[] = Object.keys(groupBody).length > 0 ? [{ kind: "group", body: groupBody }] : [];
  return [...clearing, ...groupStep, ...editing, ...adding];
}

/**
 * The draft on top of a newer version of the group (after "Tải lại" or a save that stopped half-way):
 * fields the user has not changed since `before` take the new values, typed ones stay; rows that are
 * new in the draft stay, rows the server added appear.
 */
export function rebase(draft: GroupDraft, before: OptionGroup, after: OptionGroup, newKey: () => string): GroupDraft {
  const old = draftOf(before, newKey);
  const fresh = draftOf(after, newKey);
  const pick = <K extends keyof GroupDraft>(field: K) => (draft[field] === old[field] ? fresh[field] : draft[field]);
  const oldRows = new Map(old.items.map((r) => [r.optionItemId, r]));

  const items: ItemRow[] = [];
  for (const freshRow of fresh.items) {
    const typed = draft.items.find((r) => r.optionItemId === freshRow.optionItemId);
    const was = oldRows.get(freshRow.optionItemId);
    if (!typed || !was) {
      items.push(freshRow);
      continue;
    }
    const keep = <K extends "name" | "price" | "isDefaultSelected">(field: K) =>
      typed[field] === was[field] ? freshRow[field] : typed[field];
    items.push({
      ...typed,
      code: freshRow.code,
      status: freshRow.status,
      name: keep("name"),
      price: keep("price"),
      isDefaultSelected: freshRow.status === "ACTIVE" ? keep("isDefaultSelected") : freshRow.isDefaultSelected,
    });
  }
  // New rows of the draft that the server does not have yet keep their place at the end.
  items.push(...draft.items.filter((r) => r.optionItemId === null));

  return {
    code: fresh.code,
    name: pick("name"),
    selectionType: pick("selectionType"),
    minSelect: pick("minSelect"),
    maxSelect: pick("maxSelect"),
    items,
  };
}

/** Where a failed request came from: the field paths of its answer depend on it. */
export type ErrorSource = { kind: "create" } | { kind: "group" } | { kind: "item"; index: number } | { kind: "add"; index: number };

const isGroupField = (field: string): field is (typeof groupFields)[number] => (groupFields as readonly string[]).includes(field);

function pathOf(field: string, source: ErrorSource, draft: GroupDraft): GroupFieldPath | null {
  if (source.kind === "item" || source.kind === "add") {
    const bare = field === "defaultExtraPrice" || field === "name" || field === "code" ? field : null;
    return bare ? `items[${source.index}].${bare}` : null;
  }
  if (isGroupField(field)) return field;
  const match = /^items\[(\d+)\]\.(code|name|defaultExtraPrice)$/.exec(field);
  if (!match) return null;
  // `items[i]` of a create counts only active rows, which are the ones sent.
  const active = draft.items.flatMap((row, i) => (isActive(row) ? [i] : []));
  const index = active[Number(match[1])];
  return index === undefined ? null : `items[${index}].${match[2] as (typeof itemFields)[number]}`;
}

/** Problem codes of the library's writes, shown under a field (D2 "Bố cục form"). */
export function serverErrors(error: unknown, draft: GroupDraft, source: ErrorSource): GroupFieldErrors {
  if (!(error instanceof ApiError)) return {};
  const byField = (message: (given?: string) => string): GroupFieldErrors => {
    const result: GroupFieldErrors = {};
    for (const e of error.problem.errors ?? []) {
      const path = pathOf(e.field, source, draft);
      if (path) result[path] ??= message(e.message);
    }
    return result;
  };
  switch (error.code) {
    case "OPTION_GROUP_MINMAX_INVALID":
      return {
        maxSelect:
          "Tối thiểu, tối đa và số lựa chọn chọn sẵn chưa khớp: tối thiểu ≤ tối đa, chọn một thì tối đa là 1, chọn sẵn không quá tối đa.",
      };
    case "CATALOG_CODE_TAKEN":
      if (source.kind === "add") return { [`items[${source.index}].code`]: "Mã này đã có trong nhóm, kể cả lựa chọn đã lưu trữ. Đặt mã khác." };
      return { code: "Mã nhóm này đã được dùng, kể cả bởi nhóm đã lưu trữ. Đặt mã khác." };
    case "CATALOG_PRICE_NEGATIVE":
      return byField(() => "Giá thêm không được âm.");
    case "VALIDATION_FAILED":
      return byField((given) => given ?? "Giá trị chưa hợp lệ.");
    default:
      return {};
  }
}
