import { formatVnd } from "@hayi/domain-utils";
import { Button, Card, Field, Skeleton, Table } from "@hayi/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { errorCode, useApi } from "../../../lib/api";
import { FormAlert } from "../../../lib/form-alert";
import { type OptionGroup, optionGroupKeys, optionGroupsQuery } from "../api/option-groups";
import { type Product, productKeys, replaceOptionGroups, replaceOptionItemOverrides } from "../api/products";
import { activationIssues } from "../product-editor";
import { parsePrice } from "../product-form";
import {
  type AttachedGroup,
  GROUPS_MAX,
  type OptionsEditor,
  type OptionsFieldErrors,
  type OverridesBody,
  attachGroup,
  groupHeadingId,
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
  rebaseOptions,
  sameOptions,
  serverErrors,
  setItem,
  setLimits,
} from "../product-options";
import { useProductPage } from "./product-page";

/** A request of the save failed; `sent` is the overrides body when it was that one. */
class SaveFailure extends Error {
  constructor(
    readonly error: unknown,
    readonly sent: OverridesBody | null,
  ) {
    super("save step failed");
  }
}

/** Answers that mean the Product on screen is out of date: "Tải lại". */
const staleCodes = new Set(["VERSION_CONFLICT", "OPTION_ITEM_NOT_ATTACHED", "CATALOG_PRODUCT_INVALID_TRANSITION"]);
/** Answers that mean the library changed: it is reloaded and the groups are checked again. */
const libraryCodes = new Set(["OPTION_GROUP_MINMAX_INVALID", "CATALOG_OPTION_ARCHIVED", "CATALOG_OPTION_GROUP_NOT_FOUND"]);


/**
 * D3d screen 24, tab "Tuỳ chọn": the library groups attached to this Product, in the order customers
 * see them, with min/max and item price / visibility for this Product only (API 08 §1.6, Decision AC).
 */
export function ProductOptionsTab() {
  const api = useApi();
  const { data: library, error, refetch, isFetching } = useQuery(optionGroupsQuery(api));
  if (!library) {
    return error ? (
      <div className="grid max-w-[860px] justify-items-start gap-2">
        <FormAlert tone="danger">Chưa tải được thư viện tuỳ chọn. Kiểm tra mạng rồi thử lại.</FormAlert>
        <Button variant="outline" busy={isFetching} onClick={() => void refetch()}>
          Thử lại
        </Button>
      </div>
    ) : (
      <Skeleton className="h-80 w-full max-w-[860px]" />
    );
  }
  return <OptionsForm library={library} />;
}

function OptionsForm({ library }: { library: OptionGroup[] }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const { product, canManage, canPrice, setNotice, setIssues, reload } = useProductPage();
  const readOnly = !canManage || product.status === "ARCHIVED";
  const formRef = useRef<HTMLFormElement>(null);
  const attachRef = useRef<HTMLSelectElement>(null);
  const byId = new Map(library.map((g) => [g.optionGroupId, g]));

  const [editor, setEditor] = useState<OptionsEditor>(() => optionsEditorOf(product));
  // The version the editor was made from; its `If-Match` goes with the next save (Decision AC1).
  const [base, setBase] = useState<Product>(product);
  if (product.version !== base.version) {
    if (sameOptions(product, base)) {
      setBase(product);
    } else if (!isOptionsEdited(editor, base)) {
      setBase(product);
      setEditor(optionsEditorOf(product));
    }
  }
  const [local, setLocal] = useState<OptionsFieldErrors>({});
  const [attempt, setAttempt] = useState(0);
  const [toAttach, setToAttach] = useState("");

  function accept(next: Product) {
    queryClient.setQueryData(productKeys.detail(next.productId), next);
    setBase(next);
  }

  const save = useMutation({
    mutationFn: async ({ from, typed }: { from: Product; typed: OptionsEditor }) => {
      let current = from;
      if (groupsChanged(current, typed)) {
        try {
          current = await replaceOptionGroups(api, current, groupsBody(typed));
        } catch (e) {
          throw new SaveFailure(e, null);
        }
        accept(current);
      }
      // Judged again on the answer: removing a group already dropped its item overrides (AC2).
      if (overridesChanged(current, typed, library)) {
        const body = overridesBody(typed, library);
        try {
          current = await replaceOptionItemOverrides(api, current, body);
        } catch (e) {
          throw new SaveFailure(e, body);
        }
        accept(current);
      }
      return current;
    },
    // What is on screen is what was sent; it stays as typed (text typed during the save included).
    onSuccess: () => setNotice({ tone: "success", text: "Đã lưu tuỳ chọn của món." }),
    onError: (failure) => {
      const cause = failure instanceof SaveFailure ? failure.error : failure;
      const issues = activationIssues(cause);
      if (issues) setIssues(issues);
      const code = errorCode(cause);
      if (code && libraryCodes.has(code)) void queryClient.invalidateQueries({ queryKey: optionGroupKeys.all });
    },
  });

  const failure = save.error instanceof SaveFailure ? save.error : null;
  const failedError = failure?.error ?? save.error;
  const code = errorCode(failedError);
  const stale = code !== undefined && staleCodes.has(code);
  const libraryChanged = code !== undefined && libraryCodes.has(code);
  // After the library changed, the groups are checked against its new state right away.
  const errors: OptionsFieldErrors = { ...(libraryChanged ? localErrors(editor, library) : {}), ...serverErrors(failedError, failure?.sent ?? null), ...local };
  const unexpected =
    failedError != null && !stale && !libraryChanged && code !== "PRODUCT_ACTIVATION_INVALID" && Object.keys(serverErrors(failedError, failure?.sent ?? null)).length === 0;

  const firstError = Object.keys(errors)[0];
  useEffect(() => {
    if (!firstError) return;
    const control = formRef.current?.querySelector<HTMLElement>(`[data-path="${firstError}"]`);
    control?.focus();
  }, [firstError, attempt]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAttempt((n) => n + 1);
    setNotice(null);
    setIssues(null);
    save.reset();
    const found = localErrors(editor, library);
    setLocal(found);
    if (Object.keys(found).length > 0) return;
    if (!groupsChanged(base, editor) && !overridesChanged(base, editor, library)) {
      setNotice({ tone: "success", text: "Không có thay đổi nào để lưu." });
      return;
    }
    save.mutate({ from: base, typed: editor });
  }

  async function reloadLatest() {
    save.reset();
    void queryClient.invalidateQueries({ queryKey: optionGroupKeys.all });
    const fresh = await reload();
    if (!fresh) return;
    setEditor((current) => rebaseOptions(current, base, fresh));
    setBase(fresh);
  }

  function discard() {
    save.reset();
    setLocal({});
    setNotice(null);
    setEditor(optionsEditorOf(product));
    setBase(product);
  }

  /** Moving a group keeps the keyboard on the same button of that group, now in its new place. */
  function move(row: AttachedGroup, by: -1 | 1) {
    flushSync(() => setEditor((e) => moveGroup(e, row.optionGroupId, by)));
    document.getElementById(`${groupHeadingId(row.optionGroupId)}-${by < 0 ? "up" : "down"}`)?.focus();
  }

  function detach(row: AttachedGroup) {
    flushSync(() => setEditor((e) => detachGroup(e, row.optionGroupId)));
    attachRef.current?.focus();
  }

  function attach() {
    if (!toAttach) return;
    const id = toAttach;
    flushSync(() => {
      setEditor((e) => attachGroup(e, id));
      setToAttach("");
    });
    document.getElementById(groupHeadingId(id))?.focus();
  }

  const attachable = library
    .filter((g) => g.status === "ACTIVE" && !editor.groups.some((row) => row.optionGroupId === g.optionGroupId))
    .sort((a, b) => a.name.localeCompare(b.name, "vi"));

  return (
    <form ref={formRef} className="grid max-w-[860px] gap-4" onSubmit={submit} noValidate>
      <p className="max-w-prose text-label font-normal text-ink-muted">
        Nhóm và lựa chọn dùng chung, sửa ở{" "}
        <Link to="/admin/options" className="font-medium text-matcha-700 underline underline-offset-2">
          Tuỳ chọn
        </Link>
        . Ở đây chỉ chỉnh riêng cho món này: số lựa chọn được chọn, giá thêm, ẩn bớt lựa chọn. Thứ tự nhóm là thứ tự khách
        thấy; hết hàng đổi ở màn Hết hàng của chi nhánh.
      </p>

      {stale ? (
        <div className="grid justify-items-start gap-2">
          <FormAlert tone="warning">
            {code === "CATALOG_PRODUCT_INVALID_TRANSITION"
              ? "Món vừa được lưu trữ nên không sửa được nữa. Tải lại để xem trạng thái mới nhất."
              : "Món vừa được người khác cập nhật. Phần chưa lưu vẫn còn. Tải lại để lấy bản mới rồi lưu lại."}
          </FormAlert>
          <Button variant="outline" density="compact" onClick={() => void reloadLatest()}>
            Tải lại
          </Button>
        </div>
      ) : libraryChanged ? (
        <FormAlert tone="danger">
          Chưa lưu được: một nhóm vừa đổi ở thư viện tuỳ chọn. Kiểm tra nhóm được đánh dấu bên dưới rồi lưu lại.
        </FormAlert>
      ) : unexpected ? (
        <FormAlert tone="danger">Chưa lưu được tuỳ chọn. Bạn thử lại sau ít phút nhé.</FormAlert>
      ) : null}
      {product.status === "ARCHIVED" ? <p className="text-label font-normal text-ink-muted">Món đã lưu trữ nên không sửa được nữa.</p> : null}

      {editor.groups.length === 0 ? (
        <Card className="p-6 text-body text-ink-muted">
          {readOnly ? "Món chưa gắn nhóm tuỳ chọn nào." : "Món chưa gắn nhóm tuỳ chọn nào. Chọn nhóm ở dưới rồi bấm Gắn."}
        </Card>
      ) : null}

      {editor.groups.map((row, i) => {
        const group = byId.get(row.optionGroupId);
        if (!group) return null;
        return (
          <GroupCard
            key={row.optionGroupId}
            index={i}
            count={editor.groups.length}
            group={group}
            row={row}
            editor={editor}
            errors={errors}
            readOnly={readOnly}
            priceReadOnly={readOnly || !canPrice}
            onLimits={(change) => setEditor((e) => setLimits(e, row.optionGroupId, change))}
            onItem={(id, change) => setEditor((e) => setItem(e, id, change))}
            onMove={(by) => move(row, by)}
            onDetach={() => detach(row)}
          />
        );
      })}

      {readOnly ? null : (
        <Card className="gap-4 p-6">
          <div className="flex flex-wrap items-end gap-2">
            <Field.Root className="min-w-[260px] flex-1">
              <Field.Label>Gắn nhóm tuỳ chọn</Field.Label>
              <Field.Select ref={attachRef} value={toAttach} onChange={(e) => setToAttach(e.currentTarget.value)}>
                <option value="">{attachable.length > 0 ? "Chọn nhóm…" : "Đã gắn mọi nhóm đang dùng"}</option>
                {attachable.map((g) => (
                  <option key={g.optionGroupId} value={g.optionGroupId}>
                    {g.name}
                  </option>
                ))}
              </Field.Select>
            </Field.Root>
            <Button
              variant="outline"
              aria-disabled={!toAttach || editor.groups.length >= GROUPS_MAX || undefined}
              onClick={attach}
            >
              Gắn
            </Button>
          </div>
          {editor.groups.length >= GROUPS_MAX ? (
            <p className="text-caption text-ink-muted">Một món gắn tối đa {GROUPS_MAX} nhóm tuỳ chọn.</p>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
            <Button variant="ghost" onClick={discard}>
              Bỏ thay đổi
            </Button>
            <Button type="submit" busy={save.isPending}>
              Lưu tuỳ chọn
            </Button>
          </div>
        </Card>
      )}
    </form>
  );
}

interface GroupCardProps {
  index: number;
  count: number;
  group: OptionGroup;
  row: AttachedGroup;
  editor: OptionsEditor;
  errors: OptionsFieldErrors;
  readOnly: boolean;
  priceReadOnly: boolean;
  onLimits: (change: Partial<Pick<AttachedGroup, "min" | "max">>) => void;
  onItem: (optionItemId: string, change: { price?: string; hidden?: boolean }) => void;
  onMove: (by: -1 | 1) => void;
  onDetach: () => void;
}

function limitsText(group: OptionGroup): string {
  if (group.selectionType === "SINGLE") return group.minSelect >= 1 ? "Bắt buộc chọn 1 · theo nhóm" : "Chọn tối đa 1 · theo nhóm";
  return `Theo nhóm: ${group.minSelect}–${group.maxSelect}`;
}

function GroupCard(props: GroupCardProps) {
  const { index, count, group, row, editor, errors, readOnly, priceReadOnly, onLimits, onItem, onMove, onDetach } = props;
  const headingId = groupHeadingId(group.optionGroupId);
  const items = group.items.filter((item) => item.status === "ACTIVE");
  const warning = groupWarning(group, row, editor);
  const path = (field: "min" | "max" | "group") => `groups[${index}].${field}` as const;
  const groupError = errors[path("group")];
  const limitError = errors[path("min")] ?? errors[path("max")];

  return (
    <Card
      role="region"
      aria-labelledby={headingId}
      className={`gap-4 p-5 ${groupError || limitError ? "border-danger" : ""}`}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {readOnly ? null : (
          <div className="flex flex-col">
            <MoveButton id={`${headingId}-up`} label={`Chuyển ${group.name} lên`} disabled={index === 0} onClick={() => onMove(-1)} up />
            <MoveButton id={`${headingId}-down`} label={`Chuyển ${group.name} xuống`} disabled={index === count - 1} onClick={() => onMove(1)} />
          </div>
        )}
        <h3 id={headingId} tabIndex={-1} className="text-title outline-none">
          {group.name}
        </h3>
        <span className="text-label font-normal text-ink-muted">{limitsText(group)}</span>
        {group.status !== "ACTIVE" ? <span className="text-label font-medium text-danger">Đã lưu trữ ở thư viện</span> : null}
        {readOnly ? null : (
          <Button variant="ghost" density="compact" className="ml-auto" data-path={path("group")} onClick={onDetach}>
            Gỡ khỏi món
          </Button>
        )}
      </div>
      {groupError ? <FormAlert tone="danger">{groupError}</FormAlert> : null}

      {group.selectionType === "MULTIPLE" && group.status === "ACTIVE" ? (
        <div className="flex flex-wrap items-start gap-3">
          <span className="flex h-10 items-center text-label font-medium">Món này:</span>
          <LimitInput label="tối thiểu" groupName={group.name} value={row.min} path={path("min")} error={errors[path("min")]} readOnly={readOnly} onChange={(min) => onLimits({ min })} />
          <LimitInput label="tối đa" groupName={group.name} value={row.max} path={path("max")} error={errors[path("max")]} readOnly={readOnly} onChange={(max) => onLimits({ max })} />
        </div>
      ) : limitError ? (
        <FormAlert tone="danger">{limitError}</FormAlert>
      ) : null}
      {warning ? <FormAlert tone="warning">{warning}</FormAlert> : null}

      {items.length === 0 ? (
        <p className="text-label text-ink-muted">Nhóm chưa có lựa chọn đang dùng.</p>
      ) : (
        <Table.Root aria-label={`Lựa chọn của ${group.name} ở món này`}>
          <Table.Head>
            <Table.Row>
              <Table.HeaderCell>Lựa chọn</Table.HeaderCell>
              <Table.HeaderCell numeric>Giá thêm (nhóm)</Table.HeaderCell>
              <Table.HeaderCell>Giá thêm ở món này</Table.HeaderCell>
              <Table.HeaderCell>Hiện ở món này</Table.HeaderCell>
            </Table.Row>
          </Table.Head>
          <Table.Body>
            {items.map((item) => {
              const setting = editor.items[item.optionItemId] ?? { price: "", hidden: false };
              const pricePath = `items.${item.optionItemId}.price` as const;
              const priceError = errors[pricePath];
              return (
                <Table.Row key={item.optionItemId} className={setting.hidden ? "text-ink-muted" : undefined}>
                  <Table.Cell className="font-medium">{item.name}</Table.Cell>
                  <Table.Cell numeric>{`+${formatVnd(item.defaultExtraPrice)}`}</Table.Cell>
                  <Table.Cell>
                    <Field.Root className="gap-1">
                      <Field.Label className="sr-only">{`Giá thêm ${item.name} ở món này (đồng)`}</Field.Label>
                      <Field.Input
                        data-path={pricePath}
                        inputMode="numeric"
                        autoComplete="off"
                        placeholder="Như nhóm"
                        readOnly={priceReadOnly}
                        className="w-32 tabular-nums"
                        value={setting.price}
                        onChange={(e) => onItem(item.optionItemId, { price: e.currentTarget.value })}
                        onBlur={(e) => {
                          const amount = parsePrice(e.currentTarget.value);
                          if (amount !== null) onItem(item.optionItemId, { price: formatVnd(amount) });
                        }}
                      />
                      {priceError ? <Field.Error aria-live="polite">{priceError}</Field.Error> : null}
                    </Field.Root>
                  </Table.Cell>
                  <Table.Cell>
                    <label className="flex h-10 cursor-pointer items-center gap-2 text-body has-disabled:cursor-default">
                      <input
                        type="checkbox"
                        checked={!setting.hidden}
                        disabled={readOnly}
                        aria-label={`Hiện ${item.name} ở món này`}
                        onChange={(e) => onItem(item.optionItemId, { hidden: !e.currentTarget.checked })}
                        className="size-4.5 accent-matcha-700"
                      />
                      <span aria-hidden="true">Hiện</span>
                    </label>
                  </Table.Cell>
                </Table.Row>
              );
            })}
          </Table.Body>
        </Table.Root>
      )}
    </Card>
  );
}

function LimitInput(props: {
  label: string;
  groupName: string;
  value: string;
  path: string;
  error: string | undefined;
  readOnly: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <Field.Root className="w-36 gap-1">
      <Field.Label className="sr-only">{`Chọn ${props.label} ${props.groupName} ở món này`}</Field.Label>
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className="text-label text-ink-muted">
          {props.label}
        </span>
        <Field.Input
          data-path={props.path}
          inputMode="numeric"
          autoComplete="off"
          placeholder="Như nhóm"
          readOnly={props.readOnly}
          className="w-20 tabular-nums"
          value={props.value}
          onChange={(e) => props.onChange(e.currentTarget.value)}
        />
      </div>
      {props.error ? <Field.Error aria-live="polite">{props.error}</Field.Error> : null}
    </Field.Root>
  );
}

function MoveButton({ id, label, disabled, onClick, up }: { id: string; label: string; disabled: boolean; onClick: () => void; up?: boolean }) {
  return (
    <Button
      id={id}
      variant="ghost"
      density="compact"
      aria-label={label}
      aria-disabled={disabled || undefined}
      className="h-5 w-8 px-0"
      onClick={() => !disabled && onClick()}
    >
      <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d={up ? "m5 12 5-5 5 5" : "m5 8 5 5 5-5"} />
      </svg>
    </Button>
  );
}
