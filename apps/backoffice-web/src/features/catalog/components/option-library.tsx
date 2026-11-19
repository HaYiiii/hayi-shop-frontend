import { Button, Card, Skeleton, StatusBadge, cn, focusRing } from "@hayi/ui";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useApi } from "../../../lib/api";
import { FormAlert } from "../../../lib/form-alert";
import { useWorkspace } from "../../../lib/workspace";
import { type OptionGroup, optionGroupsQuery } from "../api/option-groups";
import { OptionGroupForm } from "./option-group-form";

interface OptionLibraryProps {
  /** From the URL: a group id, `"new"`, or nothing (the first group). */
  selected: string | undefined;
  onSelect: (selected: string | undefined) => void;
}

/** Active groups first, by name; archived ones after (screen 27 lists them greyed at the end). */
function inListOrder(groups: readonly OptionGroup[]): OptionGroup[] {
  return [...groups].sort(
    (a, b) => Number(a.status !== "ACTIVE") - Number(b.status !== "ACTIVE") || a.name.localeCompare(b.name, "vi"),
  );
}

/** D3d screen 27: the brand-level option library (API 08 §1.5, Decision AB). */
export function OptionLibrary({ selected, onSelect }: OptionLibraryProps) {
  const api = useApi();
  const { permissions } = useWorkspace();
  // UX only: the API answers 403 (Decision M4).
  const canManage = permissions.has("CATALOG_MANAGE");
  const canPrice = permissions.has("CATALOG_PRICE_MANAGE");
  const { data, error, refetch, isFetching } = useQuery(optionGroupsQuery(api));
  const [created, setCreated] = useState<string | null>(null);

  const groups = data ? inListOrder(data) : undefined;
  const creating = selected === "new" && canManage;
  const current = creating ? null : (groups?.find((g) => g.optionGroupId === selected) ?? groups?.[0]);

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-heading-lg text-balance">Tuỳ chọn</h1>
        <span className="text-body text-ink-muted">Nhóm lựa chọn dùng chung cho nhiều món</span>
        {canManage ? (
          <Button className="ml-auto" onClick={() => onSelect("new")}>
            Tạo nhóm
          </Button>
        ) : null}
      </div>

      {created ? <FormAlert tone="success">{`Đã tạo nhóm “${created}”.`}</FormAlert> : null}

      {error && !data ? (
        <div className="grid justify-items-start gap-2">
          <FormAlert tone="danger">Chưa tải được thư viện tuỳ chọn. Kiểm tra mạng rồi thử lại.</FormAlert>
          <Button variant="outline" busy={isFetching} onClick={() => void refetch()}>
            Thử lại
          </Button>
        </div>
      ) : !groups ? (
        <Skeleton className="h-80 w-full" />
      ) : groups.length === 0 && !creating ? (
        <p role="status" className="rounded-lg border border-dashed border-line-strong bg-paper p-6 text-center text-body text-ink-muted">
          {canManage ? "Chưa có nhóm tuỳ chọn nào. Bấm Tạo nhóm để thêm nhóm đầu tiên, ví dụ Mức đường." : "Chưa có nhóm tuỳ chọn nào."}
        </p>
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
          <Card role="region" aria-label="Nhóm tuỳ chọn" className="gap-0.5 p-2">
              {groups.map((group) => {
                const active = group.items.filter((i) => i.status === "ACTIVE").length;
                const archived = group.status !== "ACTIVE";
                return (
                  <button
                    key={group.optionGroupId}
                    type="button"
                    aria-current={!creating && current?.optionGroupId === group.optionGroupId ? "true" : undefined}
                    onClick={() => {
                      setCreated(null);
                      onSelect(group.optionGroupId);
                    }}
                    className={cn(
                      "flex min-h-13 w-full cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-left text-ink transition-colors duration-150",
                      "hover:bg-sunken aria-[current=true]:bg-matcha-100",
                      focusRing,
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className={cn("block font-semibold break-words", archived && "text-ink-muted")}>{group.name}</span>
                      <span className="text-caption text-ink-muted tabular-nums">{`${active} lựa chọn`}</span>
                    </span>
                    {archived ? <StatusBadge tone="danger">Đã lưu trữ</StatusBadge> : null}
                  </button>
                );
              })}
          </Card>

          {creating || current ? (
            <OptionGroupForm
              // A new form per group: the draft belongs to the group it was made from.
              key={creating ? "new" : current!.optionGroupId}
              group={creating ? null : current!}
              canManage={canManage}
              canPrice={canPrice}
              onCreated={(group) => {
                setCreated(group.name);
                onSelect(group.optionGroupId);
              }}
              onCancelCreate={() => onSelect(undefined)}
              onReload={() => void refetch()}
            />
          ) : null}
        </div>
      )}
    </>
  );
}
