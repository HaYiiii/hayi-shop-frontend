import { formatVnd } from "@hayi/domain-utils";
import { Button, Card, Dialog, Field, StatusBadge, Table } from "@hayi/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, type ReactNode, type RefObject, useEffect, useId, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { errorCode, useApi } from "../../../lib/api";
import { FormAlert } from "../../../lib/form-alert";
import {
  type OptionGroup,
  addOptionItem,
  archiveOptionGroup,
  archiveOptionItem,
  createOptionGroup,
  optionGroupKeys,
  updateOptionGroup,
  updateOptionItem,
} from "../api/option-groups";
import { slugify } from "../category-form";
import {
  CODE_MAX,
  type ErrorSource,
  type GroupDraft,
  type GroupFieldErrors,
  type GroupFieldPath,
  ITEMS_MAX,
  type ItemRow,
  NAME_MAX,
  type SaveStep,
  addItem,
  createBody,
  draftOf,
  emptyGroupDraft,
  fieldOrder,
  localErrors,
  rebase,
  removeNewItem,
  savePlan,
  serverErrors,
  setSelectionType,
  toggleDefault,
} from "../option-form";
import { parsePrice } from "../product-form";

let nextKey = 0;
const newKey = () => `item-${++nextKey}`;

/** "Trân châu đen" → "TRAN-CHAU-DEN": the code a new row gets until the user types one. */
const autoCode = (name: string) => slugify(name, CODE_MAX).toUpperCase();

/** A request of a save failed: where, so its field errors land on the right row. */
class SaveFailure extends Error {
  constructor(
    readonly error: unknown,
    readonly source: ErrorSource,
  ) {
    super("save failed");
  }
}

const sourceOf = (step: SaveStep): ErrorSource => (step.kind === "group" ? { kind: "group" } : { kind: step.kind, index: step.index });

/** Codes answered with "Tải lại": the group on screen is out of date. */
const staleCodes = new Set(["VERSION_CONFLICT", "CATALOG_OPTION_ARCHIVED", "CATALOG_OPTION_GROUP_NOT_FOUND", "CATALOG_OPTION_ITEM_NOT_FOUND"]);

interface OptionGroupFormProps {
  /** `null` = a new group. */
  group: OptionGroup | null;
  canManage: boolean;
  /** `CATALOG_PRICE_MANAGE`: without it, extra prices are read-only and new items cost 0 (Decision AB4). */
  canPrice: boolean;
  onCreated: (group: OptionGroup) => void;
  onCancelCreate: () => void;
  onReload: () => void;
}

/**
 * D3d screen 27, right card: one option group with its items. Edits go out as the few requests the
 * API needs (savePlan); a request that fails stops the save, keeps what is typed and points at the field.
 */
export function OptionGroupForm({ group, canManage, canPrice, onCreated, onCancelCreate, onReload }: OptionGroupFormProps) {
  const api = useApi();
  const queryClient = useQueryClient();
  const formRef = useRef<HTMLFormElement>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const isNew = group === null;
  const readOnly = !canManage || group?.status === "ARCHIVED";

  const [draft, setDraft] = useState<GroupDraft>(() => (group ? draftOf(group, newKey) : emptyGroupDraft()));
  // The version the draft was made from; a newer one in the cache is merged in (rebase).
  const [base, setBase] = useState<OptionGroup | null>(group);
  if (group && base && group.version !== base.version) {
    setDraft(rebase(draft, base, group, newKey));
    setBase(group);
  }
  const [local, setLocal] = useState<GroupFieldErrors>({});
  const [attempt, setAttempt] = useState(0);
  const [saved, setSaved] = useState(false);
  const [archiving, setArchiving] = useState<{ kind: "group" } | { kind: "item"; row: ItemRow } | null>(null);

  const putInCache = (next: OptionGroup) =>
    queryClient.setQueryData<OptionGroup[]>(optionGroupKeys.list(), (list) => {
      if (!list) return [next];
      return list.some((g) => g.optionGroupId === next.optionGroupId)
        ? list.map((g) => (g.optionGroupId === next.optionGroupId ? next : g))
        : [...list, next];
    });

  const create = useMutation({
    mutationFn: (body: Parameters<typeof createOptionGroup>[1]) => createOptionGroup(api, body),
    onSuccess: (created) => {
      putInCache(created);
      onCreated(created);
    },
  });

  const save = useMutation({
    mutationFn: async ({ from, steps, rows }: { from: OptionGroup; steps: SaveStep[]; rows: readonly ItemRow[] }) => {
      let current = from;
      for (const step of steps) {
        try {
          current = await runStep(step, current);
        } catch (error) {
          throw new SaveFailure(error, sourceOf(step));
        }
        // An added item now comes from the server: its draft row goes, or it would show twice.
        if (step.kind === "add") {
          const key = rows[step.index]?.key;
          setDraft((d) => ({ ...d, items: d.items.filter((r) => r.key !== key) }));
        }
        // Each answer carries the next version (AB1); the cache follows so a failure later keeps what went through.
        putInCache(current);
      }
      return current;
    },
    onSuccess: (result) => {
      setDraft(draftOf(result, newKey));
      setBase(result);
      setSaved(true);
    },
  });

  function runStep(step: SaveStep, current: OptionGroup): Promise<OptionGroup> {
    switch (step.kind) {
      case "group":
        return updateOptionGroup(api, current, step.body);
      case "item":
        return updateOptionItem(api, current, step.optionItemId, step.body);
      case "add":
        return addOptionItem(api, current, step.body);
    }
  }

  const archive = useMutation({
    mutationFn: (target: { kind: "group" } | { kind: "item"; row: ItemRow }) => {
      if (!group) throw new Error("no group");
      return target.kind === "group" ? archiveOptionGroup(api, group) : archiveOptionItem(api, group, target.row.optionItemId!);
    },
    onSuccess: (next) => {
      putInCache(next);
      setArchiving(null);
    },
  });

  const failure = save.error instanceof SaveFailure ? save.error : null;
  const failedError = isNew ? create.error : (failure?.error ?? save.error);
  const source: ErrorSource = isNew ? { kind: "create" } : (failure?.source ?? { kind: "group" });
  const server = serverErrors(failedError, draft, source);
  const errors: GroupFieldErrors = { ...server, ...local };
  const code = errorCode(failedError);
  const stale = code !== undefined && staleCodes.has(code);
  const unexpected = failedError != null && !stale && Object.keys(server).length === 0;
  useFocusFirstError(formRef, draft, errors, attempt);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAttempt((n) => n + 1);
    setSaved(false);
    create.reset();
    save.reset();
    const found = localErrors(draft, isNew);
    setLocal(found);
    if (Object.keys(found).length > 0) return;
    if (!group) {
      create.mutate(createBody(draft));
      return;
    }
    const steps = savePlan(group, draft);
    if (steps.length === 0) {
      setSaved(true);
      return;
    }
    save.mutate({ from: group, steps, rows: draft.items });
  }

  function discard() {
    if (!group) {
      onCancelCreate();
      return;
    }
    setDraft(draftOf(group, newKey));
    setLocal({});
    setSaved(false);
    save.reset();
  }

  const set = (patch: Partial<GroupDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const setRow = (key: string, patch: Partial<ItemRow>) =>
    setDraft((d) => ({ ...d, items: d.items.map((r) => (r.key === key ? { ...r, ...patch } : r)) }));

  function addRow() {
    const index = draft.items.length;
    flushSync(() =>
      setDraft((d) => {
        const next = addItem(d, newKey());
        // Without CATALOG_PRICE_MANAGE a new item can only cost 0 (Decision AB4).
        if (!canPrice && next.items.length > d.items.length) next.items[index] = { ...next.items[index]!, price: formatVnd(0) };
        return next;
      }),
    );
    const control = formRef.current?.elements.namedItem(`items[${index}].name`);
    if (control instanceof HTMLElement) control.focus();
  }

  function removeRow(key: string) {
    flushSync(() => setDraft((d) => removeNewItem(d, key)));
    addRef.current?.focus();
  }

  const error = (path: GroupFieldPath) => (errors[path] ? <Field.Error aria-live="polite">{errors[path]}</Field.Error> : null);
  const activeItems = draft.items.filter((r) => r.status === "ACTIVE").length;

  return (
    <Card className="min-w-0 gap-4 p-6">
      <form ref={formRef} aria-labelledby={titleId} className="grid gap-4.5" onSubmit={submit} noValidate>
        <div className="flex flex-wrap items-center gap-2.5">
          <h2 id={titleId} className="text-title break-words">
            {group ? group.name : "Nhóm mới"}
          </h2>
          {group ? (
            <>
              <StatusBadge tone={group.status === "ACTIVE" ? "success" : "danger"} dot>
                {group.status === "ACTIVE" ? "Đang dùng" : "Đã lưu trữ"}
              </StatusBadge>
              <span translate="no" className="font-mono text-label font-semibold tracking-wide text-ink-muted">
                {group.code}
              </span>
            </>
          ) : null}
          {group && !readOnly ? (
            <Button variant="ghost" density="compact" className="ml-auto" onClick={() => setArchiving({ kind: "group" })}>
              Lưu trữ nhóm…
            </Button>
          ) : null}
        </div>

        {stale ? (
          <div className="grid justify-items-start gap-2">
            <FormAlert tone="warning">
              {code === "VERSION_CONFLICT"
                ? "Nhóm vừa được người khác cập nhật. Phần chưa lưu vẫn còn trong form. Tải lại để xem bản mới rồi lưu lại."
                : "Nhóm hoặc lựa chọn này vừa được lưu trữ. Tải lại để xem bản mới nhất."}
            </FormAlert>
            <Button
              variant="outline"
              density="compact"
              onClick={() => {
                save.reset();
                onReload();
              }}
            >
              Tải lại
            </Button>
          </div>
        ) : unexpected ? (
          <FormAlert tone="danger">
            {isNew ? "Chưa tạo được nhóm." : "Chưa lưu hết thay đổi; phần đã lưu được giữ lại."} Bạn thử lại sau ít phút nhé.
          </FormAlert>
        ) : saved ? (
          <FormAlert tone="success">Đã lưu nhóm.</FormAlert>
        ) : null}

        {isNew ? (
          <Field.Group>
            <Field.Root>
              <Field.Label>Mã nhóm</Field.Label>
              <Field.Input
                name="code"
                autoComplete="off"
                spellCheck={false}
                autoCapitalize="characters"
                translate="no"
                maxLength={CODE_MAX}
                className="font-mono font-semibold tracking-wide uppercase"
                value={draft.code}
                onChange={(e) => set({ code: e.currentTarget.value })}
              />
              {error("code")}
              <Field.Hint>Chữ in hoa, số, dấu gạch ngang. Không đổi được sau khi tạo.</Field.Hint>
            </Field.Root>
          </Field.Group>
        ) : null}

        <fieldset className="grid gap-2" disabled={readOnly}>
          <legend className="mb-2 text-label text-ink">Kiểu chọn</legend>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {(
              [
                ["SINGLE", "Chọn một", "Ví dụ: mức đường"],
                ["MULTIPLE", "Chọn nhiều", "Ví dụ: topping"],
              ] as const
            ).map(([value, label, example]) => (
              <label key={value} className="flex min-h-10 cursor-pointer items-center gap-2 text-body font-medium">
                <input
                  type="radio"
                  name="selectionType"
                  value={value}
                  checked={draft.selectionType === value}
                  onChange={() => setDraft((d) => setSelectionType(d, value))}
                  className="size-4.5 accent-matcha-700"
                />
                {label} <span className="font-normal text-ink-muted">· {example}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <Field.Group style={{ gridTemplateColumns: "minmax(0, 1fr) 120px 120px" }}>
          <Field.Root>
            <Field.Label>Tên nhóm (khách thấy)</Field.Label>
            <Field.Input
              name="name"
              autoComplete="off"
              maxLength={NAME_MAX}
              readOnly={readOnly}
              value={draft.name}
              onChange={(e) => set({ name: e.currentTarget.value })}
            />
            {error("name")}
          </Field.Root>
          <Field.Root>
            <Field.Label>Chọn tối thiểu</Field.Label>
            <Field.Input
              name="minSelect"
              inputMode="numeric"
              autoComplete="off"
              readOnly={readOnly}
              className="tabular-nums"
              value={draft.minSelect}
              onChange={(e) => set({ minSelect: e.currentTarget.value })}
            />
            {error("minSelect")}
          </Field.Root>
          <Field.Root>
            <Field.Label>Chọn tối đa</Field.Label>
            <Field.Input
              name="maxSelect"
              inputMode="numeric"
              autoComplete="off"
              readOnly={readOnly || draft.selectionType === "SINGLE"}
              className="tabular-nums"
              value={draft.maxSelect}
              onChange={(e) => set({ maxSelect: e.currentTarget.value })}
            />
            {error("maxSelect")}
          </Field.Root>
        </Field.Group>
        <p className="-mt-2 text-caption text-ink-muted">
          Tối thiểu 0 là không bắt buộc; từ 1 trở lên là khách phải chọn. Nhóm chọn một luôn có tối đa 1.
        </p>

        <section aria-label="Lựa chọn" className="grid gap-2.5">
          {draft.items.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line-strong p-4 text-center text-body text-ink-muted">
              Nhóm chưa có lựa chọn nào.
            </p>
          ) : (
            <Table.Root aria-label={`Lựa chọn của ${group?.name ?? "nhóm mới"} · ${activeItems} đang dùng`}>
              <Table.Head>
                <Table.Row>
                  <Table.HeaderCell>Lựa chọn</Table.HeaderCell>
                  <Table.HeaderCell>Mã</Table.HeaderCell>
                  <Table.HeaderCell>Giá thêm mặc định</Table.HeaderCell>
                  <Table.HeaderCell>Chọn sẵn</Table.HeaderCell>
                  <Table.HeaderCell>Trạng thái</Table.HeaderCell>
                  <Table.HeaderCell>
                    <span className="sr-only">Thao tác</span>
                  </Table.HeaderCell>
                </Table.Row>
              </Table.Head>
              <Table.Body>
                {draft.items.map((row, i) => (
                  <ItemRowView
                    key={row.key}
                    index={i}
                    row={row}
                    readOnly={readOnly}
                    canPrice={canPrice}
                    error={error}
                    onChange={(patch) => setRow(row.key, patch)}
                    onNameChange={(name) =>
                      setRow(row.key, row.optionItemId === null && row.code === autoCode(row.name) ? { name, code: autoCode(name) } : { name })
                    }
                    onDefault={() => setDraft((d) => toggleDefault(d, row.key))}
                    onArchive={() => setArchiving({ kind: "item", row })}
                    onRemove={() => removeRow(row.key)}
                  />
                ))}
              </Table.Body>
            </Table.Root>
          )}
          {!readOnly && draft.items.length < ITEMS_MAX ? (
            <Button ref={addRef} variant="ghost" density="compact" className="justify-self-start" onClick={addRow}>
              <span aria-hidden="true">+ </span>Thêm lựa chọn
            </Button>
          ) : null}
        </section>

        {readOnly ? null : (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line pt-4">
            <span className="mr-auto text-caption text-ink-muted">
              Đổi ở đây áp cho mọi món đang gắn nhóm, trừ phần món đã chỉnh riêng.
              {canPrice ? " Giá thêm cần quyền quản lý giá." : " Bạn chưa có quyền quản lý giá nên chỉ xem được giá thêm."}
            </span>
            <Button variant="ghost" onClick={discard}>
              {isNew ? "Huỷ" : "Bỏ thay đổi"}
            </Button>
            <Button type="submit" busy={create.isPending || save.isPending}>
              {isNew ? "Tạo nhóm" : "Lưu nhóm"}
            </Button>
          </div>
        )}
      </form>

      {group ? (
        <Dialog.Root
          open={archiving !== null}
          onOpenChange={(open) => {
            if (!open) {
              setArchiving(null);
              archive.reset();
            }
          }}
        >
          {archiving ? (
            <ArchiveDialog
              title={archiving.kind === "group" ? `Lưu trữ “${group.name}”?` : `Lưu trữ “${archiving.row.name}”?`}
              description={
                archiving.kind === "group"
                  ? "Nhóm đã lưu trữ không gắn thêm vào món được và không khôi phục lại được. Món đang gắn nhóm này cần bỏ nhóm trước khi kích hoạt lại."
                  : "Lựa chọn đã lưu trữ không hiện cho khách nữa và không khôi phục lại được."
              }
              confirm={archiving.kind === "group" ? "Lưu trữ nhóm" : "Lưu trữ lựa chọn"}
              error={archive.error}
              busy={archive.isPending}
              onConfirm={() => archive.mutate(archiving)}
              onReload={() => {
                setArchiving(null);
                archive.reset();
                onReload();
              }}
            />
          ) : null}
        </Dialog.Root>
      ) : null}
    </Card>
  );
}

interface ItemRowViewProps {
  index: number;
  row: ItemRow;
  readOnly: boolean;
  canPrice: boolean;
  error: (path: GroupFieldPath) => ReactNode;
  onChange: (patch: Partial<ItemRow>) => void;
  onNameChange: (name: string) => void;
  onDefault: () => void;
  onArchive: () => void;
  onRemove: () => void;
}

function ItemRowView({ index, row, readOnly, canPrice, error, onChange, onNameChange, onDefault, onArchive, onRemove }: ItemRowViewProps) {
  const n = index + 1;
  const archived = row.status === "ARCHIVED";
  const path = (field: "code" | "name" | "defaultExtraPrice") => `items[${index}].${field}` as const;
  const isNewRow = row.optionItemId === null;

  if (archived || readOnly) {
    return (
      <Table.Row className={archived ? "text-ink-muted" : undefined}>
        <Table.Cell className="break-words">{row.name}</Table.Cell>
        <Table.Cell translate="no" className="font-mono text-label font-semibold tracking-wide">
          {row.code}
        </Table.Cell>
        <Table.Cell className="tabular-nums">{row.price}</Table.Cell>
        <Table.Cell>{row.isDefaultSelected ? "Có" : "—"}</Table.Cell>
        <Table.Cell>
          <StatusBadge tone={archived ? "danger" : "success"} dot>
            {archived ? "Đã lưu trữ" : "Đang dùng"}
          </StatusBadge>
        </Table.Cell>
        <Table.Cell />
      </Table.Row>
    );
  }

  return (
    <Table.Row>
      <Table.Cell className="min-w-[180px]">
        <Field.Root className="gap-1">
          <Field.Label className="sr-only">{`Tên lựa chọn ${n}`}</Field.Label>
          <Field.Input
            name={path("name")}
            autoComplete="off"
            maxLength={NAME_MAX}
            className="h-8"
            value={row.name}
            onChange={(e) => onNameChange(e.currentTarget.value)}
          />
          {error(path("name"))}
        </Field.Root>
      </Table.Cell>
      <Table.Cell className="min-w-[140px]">
        {isNewRow ? (
          <Field.Root className="gap-1">
            <Field.Label className="sr-only">{`Mã lựa chọn ${n}`}</Field.Label>
            <Field.Input
              name={path("code")}
              autoComplete="off"
              spellCheck={false}
              autoCapitalize="characters"
              translate="no"
              maxLength={CODE_MAX}
              className="h-8 font-mono font-semibold tracking-wide uppercase"
              value={row.code}
              onChange={(e) => onChange({ code: e.currentTarget.value })}
            />
            {error(path("code"))}
          </Field.Root>
        ) : (
          <span translate="no" className="font-mono text-label font-semibold tracking-wide text-ink-muted">
            {row.code}
          </span>
        )}
      </Table.Cell>
      <Table.Cell className="w-[140px]">
        <Field.Root className="gap-1">
          <Field.Label className="sr-only">{`Giá thêm lựa chọn ${n} (đồng)`}</Field.Label>
          <Field.Input
            name={path("defaultExtraPrice")}
            inputMode="numeric"
            autoComplete="off"
            readOnly={!canPrice}
            className="h-8 tabular-nums"
            value={row.price}
            onChange={(e) => onChange({ price: e.currentTarget.value })}
            onBlur={(e) => {
              const amount = parsePrice(e.currentTarget.value);
              if (amount !== null) onChange({ price: formatVnd(amount) });
            }}
          />
          {error(path("defaultExtraPrice"))}
        </Field.Root>
      </Table.Cell>
      <Table.Cell>
        <label className="flex h-8 cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={row.isDefaultSelected}
            onChange={onDefault}
            aria-label={`Chọn sẵn lựa chọn ${n}`}
            className="size-4.5 accent-matcha-700"
          />
        </label>
      </Table.Cell>
      <Table.Cell>
        {isNewRow ? (
          <StatusBadge tone="info">Chưa lưu</StatusBadge>
        ) : (
          <StatusBadge tone="success" dot>
            Đang dùng
          </StatusBadge>
        )}
      </Table.Cell>
      <Table.Cell className="text-right">
        {isNewRow ? (
          <Button variant="ghost" density="compact" aria-label={`Bỏ lựa chọn ${n}`} onClick={onRemove}>
            Bỏ
          </Button>
        ) : (
          <Button variant="ghost" density="compact" aria-label={`Lưu trữ lựa chọn ${n}`} onClick={onArchive}>
            Lưu trữ…
          </Button>
        )}
      </Table.Cell>
    </Table.Row>
  );
}

function ArchiveDialog(props: {
  title: string;
  description: string;
  confirm: string;
  error: unknown;
  busy: boolean;
  onConfirm: () => void;
  onReload: () => void;
}) {
  const code = errorCode(props.error);
  const stale = code !== undefined && staleCodes.has(code);
  return (
    <Dialog.Content className="max-h-[calc(100dvh-32px)] w-[min(calc(100%-32px),440px)] overflow-y-auto overscroll-contain p-6">
      <div className="grid gap-1">
        <Dialog.Title>{props.title}</Dialog.Title>
        <Dialog.Description>{props.description}</Dialog.Description>
      </div>
      {stale ? (
        <FormAlert tone="warning">Nhóm vừa thay đổi hoặc đã được lưu trữ. Tải lại để xem bản mới nhất.</FormAlert>
      ) : props.error ? (
        <FormAlert tone="danger">Chưa lưu trữ được. Bạn thử lại sau ít phút nhé.</FormAlert>
      ) : null}
      <Dialog.Actions>
        <Dialog.Close asChild>
          <Button variant="ghost">Huỷ</Button>
        </Dialog.Close>
        {stale ? (
          <Button onClick={props.onReload}>Tải lại</Button>
        ) : (
          <Button variant="danger" busy={props.busy} onClick={props.onConfirm}>
            {props.confirm}
          </Button>
        )}
      </Dialog.Actions>
    </Dialog.Content>
  );
}

/** After a failed save, the keyboard goes to the first field (form order) that has an error. */
function useFocusFirstError(form: RefObject<HTMLFormElement | null>, draft: GroupDraft, errors: GroupFieldErrors, attempt: number) {
  const target = fieldOrder(draft).find((path) => errors[path]);
  useEffect(() => {
    if (!target) return;
    const control = form.current?.elements.namedItem(target);
    if (control instanceof HTMLElement) control.focus();
  }, [form, target, attempt]);
}
