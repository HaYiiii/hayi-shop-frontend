"use client";

import { formatVnd } from "@hayi/domain-utils";
import { Chip, cn } from "@hayi/ui";
import { useId, useState } from "react";
import {
  type DetailOptionGroup,
  type ProductDetail,
  type Selection,
  canPick,
  chooseVariant,
  initialSelection,
  missing,
  ruleText,
  toggleItem,
  unavailableText,
} from "../option-selection";

/**
 * D3a screen 3: size and options within each group's min/max. Prices are the server's, per choice; there is
 * no total until "Thêm vào giỏ" prices the choice with the server (S4, agreed 2026-11-19).
 */
/**
 * `locked`: the product cannot be ordered now (outside its selling hours, D3a screen 3b): every choice is shown,
 * none can be picked, and nothing is reported missing.
 */
export function ProductOptions({ product, locked = false }: { product: ProductDetail; locked?: boolean }) {
  const [selection, setSelection] = useState<Selection>(() => (locked ? { variantId: null, items: {} } : initialSelection(product)));
  const stillMissing = locked ? [] : missing(product, selection);
  const missingGroups = new Set(stillMissing.flatMap((m) => (m.kind === "group" ? [m.optionGroupId] : [])));

  return (
    <div className="grid gap-5">
      {product.variants.length > 0 ? (
        <Choice legend="Size" rule="Bắt buộc · chọn 1" missingText={!locked && selection.variantId === null ? "Còn thiếu: chọn size" : null}>
          <div className="flex flex-wrap gap-2">
            {product.variants.map((variant) => {
              const why = locked ? null : unavailableText(variant.availability);
              return (
                <Chip
                  key={variant.variantId}
                  pressed={selection.variantId === variant.variantId}
                  unavailable={locked || why !== null}
                  onClick={() => setSelection((s) => chooseVariant(s, variant))}
                >
                  {`${variant.name} · ${formatVnd(variant.price)}${why ? ` · ${why}` : ""}`}
                </Chip>
              );
            })}
          </div>
        </Choice>
      ) : null}

      {product.optionGroups.map((group) => (
        <Choice
          key={group.optionGroupId}
          legend={group.name}
          rule={ruleText(group)}
          missingText={missingGroups.has(group.optionGroupId) ? `Còn thiếu: chọn ${group.name.toLocaleLowerCase("vi")}` : null}
        >
          {group.selectionType === "SINGLE" ? (
            <SingleChoice group={group} selection={selection} locked={locked} onToggle={(item) => setSelection((s) => toggleItem(s, group, item))} />
          ) : (
            <MultipleChoice group={group} selection={selection} locked={locked} onToggle={(item) => setSelection((s) => toggleItem(s, group, item))} />
          )}
        </Choice>
      ))}
    </div>
  );
}

const extraText = (price: number) => (price > 0 ? `+${formatVnd(price)}` : null);

interface GroupProps {
  group: DetailOptionGroup;
  selection: Selection;
  onToggle: (item: DetailOptionGroup["items"][number]) => void;
  locked: boolean;
}

function SingleChoice({ group, selection, onToggle, locked }: GroupProps) {
  const picked = selection.items[group.optionGroupId] ?? [];
  return (
    <div className="flex flex-wrap gap-2">
      {group.items.map((item) => {
        const why = unavailableText(item.availability);
        const extra = extraText(item.extraPrice);
        return (
          <Chip
            key={item.optionItemId}
            pressed={picked.includes(item.optionItemId)}
            unavailable={locked || !canPick(selection, group, item)}
            onClick={() => onToggle(item)}
          >
            {[item.name, extra, why].filter(Boolean).join(" · ")}
          </Chip>
        );
      })}
    </div>
  );
}

function MultipleChoice({ group, selection, onToggle, locked }: GroupProps) {
  const picked = selection.items[group.optionGroupId] ?? [];
  const full = picked.length >= group.maxSelect;
  return (
    <ul className="grid">
      {group.items.map((item) => {
        const checked = picked.includes(item.optionItemId);
        const why = unavailableText(item.availability);
        const blocked = locked || !canPick(selection, group, item);
        const extra = extraText(item.extraPrice);
        return (
          <li key={item.optionItemId}>
            <label className={cn("flex min-h-11 cursor-pointer items-center gap-3 text-body-lg font-medium", blocked && "cursor-not-allowed text-ink-subtle")}>
              <input
                type="checkbox"
                checked={checked}
                aria-disabled={blocked || undefined}
                onChange={() => !locked && onToggle(item)}
                className="size-5 accent-matcha-700"
              />
              <span className="min-w-0 break-words">
                {item.name}
                {why ? <span className="text-label font-normal">{` · ${why}`}</span> : null}
              </span>
              {extra ? <span className="ml-auto text-body text-ink-muted tabular-nums">{extra}</span> : null}
            </label>
          </li>
        );
      })}
      {full && group.items.length > group.maxSelect ? (
        <li className="text-caption text-ink-muted">{`Đã chọn đủ ${group.maxSelect}. Bỏ một lựa chọn để chọn món khác.`}</li>
      ) : null}
    </ul>
  );
}

function Choice({ legend, rule, missingText, children }: { legend: string; rule: string; missingText: string | null; children: React.ReactNode }) {
  const nameId = useId();
  const ruleId = useId();
  const missingId = useId();
  // The group is named by its legend alone; the rule and what is missing describe it.
  return (
    <fieldset className="grid gap-2" aria-labelledby={nameId} aria-describedby={missingText ? `${ruleId} ${missingId}` : ruleId}>
      <div className="mb-2 flex items-center gap-2">
        <span id={nameId} className="text-body-lg font-semibold">
          {legend}
        </span>
        <span id={ruleId} className="ml-auto text-caption font-medium text-ink-muted">
          {rule}
        </span>
      </div>
      {children}
      {missingText ? (
        <p id={missingId} className="text-caption font-medium text-warning">
          {missingText}
        </p>
      ) : null}
    </fieldset>
  );
}
