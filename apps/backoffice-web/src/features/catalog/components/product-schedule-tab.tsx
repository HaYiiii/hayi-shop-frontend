import { Button, Card, Field } from "@hayi/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { flushSync } from "react-dom";
import { errorCode, useApi } from "../../../lib/api";
import { FormAlert } from "../../../lib/form-alert";
import { type Product, productKeys, replaceSellingSchedules } from "../api/products";
import {
  PERIODS_MAX,
  type ScheduleEditor,
  type ScheduleErrors,
  WINDOWS_MAX,
  addPeriod,
  addWindow,
  dayOptions,
  removePeriod,
  removeWindow,
  sameSchedules,
  scheduleEdited,
  scheduleEditorOf,
  scheduleErrors,
  schedulesBody,
  serverScheduleErrors,
  setPeriod,
  setWindow,
} from "../selling-schedule";
import { useProductPage } from "./product-page";

let nextKey = 0;
const newKey = () => `schedule-${++nextKey}`;

/**
 * D3d screen 26, section "Lịch bán" of tab "Lịch bán & tag" (tags come with FE #53): selling periods with an
 * optional date range and time windows by day (Decision AK). No period = sold whenever the Branch takes orders.
 */
export function ProductScheduleTab() {
  const api = useApi();
  const queryClient = useQueryClient();
  const { product, canManage, setNotice, reload } = useProductPage();
  const readOnly = !canManage || product.status === "ARCHIVED";

  const [editor, setEditor] = useState<ScheduleEditor>(() => scheduleEditorOf(product, newKey));
  // The version the editor was made from; its `If-Match` goes with the next save (the #35 pattern).
  const [base, setBase] = useState<Product>(product);
  if (product.version !== base.version) {
    if (sameSchedules(product, base)) {
      setBase(product);
    } else if (!scheduleEdited(editor, base)) {
      setBase(product);
      setEditor(scheduleEditorOf(product, newKey));
    }
  }
  const [local, setLocal] = useState<ScheduleErrors>({});

  const save = useMutation({
    mutationFn: (from: Product) => replaceSellingSchedules(api, from, schedulesBody(editor)),
    onSuccess: (saved) => {
      queryClient.setQueryData(productKeys.detail(saved.productId), saved);
      setBase(saved);
      setNotice({ tone: "success", text: "Đã lưu lịch bán. Khách thấy thay đổi trên menu sau khoảng một phút." });
    },
  });
  const code = errorCode(save.error);
  const errors: ScheduleErrors = { ...serverScheduleErrors(save.error), ...local };
  const stale = code === "VERSION_CONFLICT" || code === "CATALOG_PRODUCT_INVALID_TRANSITION";
  const unexpected = save.isError && !stale && code !== "CATALOG_SELLING_SCHEDULE_INVALID";

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setNotice(null);
    save.reset();
    const found = scheduleErrors(editor);
    flushSync(() => setLocal(found));
    const first = Object.keys(found)[0];
    if (first) {
      form.querySelector<HTMLElement>(`[data-at="${first}"]`)?.focus();
      return;
    }
    if (!scheduleEdited(editor, base)) {
      setNotice({ tone: "success", text: "Không có thay đổi nào để lưu." });
      return;
    }
    save.mutate(base, {
      onError: (error) => {
        const server = Object.keys(serverScheduleErrors(error))[0];
        if (server) requestAnimationFrame(() => form.querySelector<HTMLElement>(`[data-at="${server}"]`)?.focus());
      },
    });
  }

  async function reloadLatest() {
    save.reset();
    const fresh = await reload();
    // What is typed stays; the next save goes on the new version.
    if (fresh) setBase(fresh);
  }

  /** Removing a row shifts the rows after it: errors keyed by position no longer point at the right row. */
  function removeRows(change: (editor: ScheduleEditor) => ScheduleEditor) {
    save.reset();
    setLocal({});
    setEditor(change);
  }

  function addPeriodAndFocus() {
    const index = editor.length;
    flushSync(() => setEditor((e) => addPeriod(e, newKey(), newKey())));
    document.querySelector<HTMLElement>(`[data-at="period-${index}.startDate"]`)?.focus();
  }

  function addWindowAndFocus(periodKey: string, periodIndex: number, windowCount: number) {
    flushSync(() => setEditor((e) => addWindow(e, periodKey, newKey())));
    document.querySelector<HTMLElement>(`[data-at="period-${periodIndex}.window-${windowCount}"]`)?.focus();
  }

  return (
    <Card className="max-w-[860px] gap-5 p-6">
      <form className="grid gap-5" onSubmit={submit} noValidate aria-labelledby="schedule-title">
        <div className="grid gap-1">
          <h2 id="schedule-title" className="text-title">
            Lịch bán
          </h2>
          <p className="text-label font-normal text-ink-muted">
            Để trống: bán mọi lúc chi nhánh nhận đơn. Có lịch: khách chỉ đặt được món này cho giờ lấy nằm trong lịch.
          </p>
        </div>

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
        ) : unexpected ? (
          <FormAlert tone="danger">Chưa lưu được lịch bán. Bạn thử lại sau ít phút nhé.</FormAlert>
        ) : null}

        {editor.length === 0 ? (
          <p className="rounded-md bg-sunken px-3 py-2.5 text-body">Món đang bán mọi lúc chi nhánh nhận đơn.</p>
        ) : null}

        {editor.map((period, i) => (
          <fieldset key={period.key} className="grid gap-3 rounded-lg border border-line p-4" aria-label={`Đợt bán ${i + 1}`}>
            <div className="flex flex-wrap items-start gap-3">
              <Field.Root className="w-44 gap-1">
                <Field.Label>Từ ngày</Field.Label>
                <Field.Input
                  type="date"
                  data-at={`period-${i}.startDate`}
                  readOnly={readOnly}
                  value={period.startDate}
                  onChange={(e) => {
                    const startDate = e.currentTarget.value;
                    setEditor((ed) => setPeriod(ed, period.key, { startDate }));
                  }}
                />
              </Field.Root>
              <Field.Root className="w-44 gap-1">
                <Field.Label>Đến ngày</Field.Label>
                <Field.Input
                  type="date"
                  data-at={`period-${i}.endDate`}
                  readOnly={readOnly}
                  value={period.endDate}
                  onChange={(e) => {
                    const endDate = e.currentTarget.value;
                    setEditor((ed) => setPeriod(ed, period.key, { endDate }));
                  }}
                />
                {errors[`period-${i}.endDate`] ? <Field.Error aria-live="polite">{errors[`period-${i}.endDate`]}</Field.Error> : null}
              </Field.Root>
              {readOnly ? null : (
                <Button variant="ghost" density="compact" className="ml-auto" onClick={() => removeRows((ed) => removePeriod(ed, period.key))}>
                  Xoá đợt
                </Button>
              )}
            </div>
            <p className="text-caption text-ink-muted">Để trống ngày: áp dụng không giới hạn ngày. Không có khung giờ: bán cả ngày.</p>

            <ul className="grid gap-2">
              {period.windows.map((window, j) => {
                const at = `period-${i}.window-${j}`;
                const n = `Đợt ${i + 1} khung ${j + 1}`;
                return (
                  <li key={window.key} className="grid gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Field.Root className="w-36 gap-1">
                        <Field.Label className="sr-only">{`${n} áp dụng`}</Field.Label>
                        <Field.Select
                          data-at={at}
                          aria-invalid={errors[at] ? true : undefined}
                          aria-describedby={errors[at] ? `${at}-error` : undefined}
                          disabled={readOnly}
                          value={window.day}
                          onChange={(e) => {
                            const day = e.currentTarget.value;
                            setEditor((ed) => setWindow(ed, period.key, window.key, { day }));
                          }}
                        >
                          {dayOptions.map((d) => (
                            <option key={d.value} value={d.value}>
                              {d.label}
                            </option>
                          ))}
                        </Field.Select>
                      </Field.Root>
                      <Field.Root className="w-32 gap-1">
                        <Field.Label className="sr-only">{`${n} bắt đầu`}</Field.Label>
                        <Field.Input
                          type="time"
                          readOnly={readOnly}
                          aria-invalid={errors[at] ? true : undefined}
                          className="tabular-nums"
                          value={window.start}
                          onChange={(e) => {
                            const start = e.currentTarget.value;
                            setEditor((ed) => setWindow(ed, period.key, window.key, { start }));
                          }}
                        />
                      </Field.Root>
                      <span aria-hidden="true">–</span>
                      <Field.Root className="w-32 gap-1">
                        <Field.Label className="sr-only">{`${n} kết thúc`}</Field.Label>
                        <Field.Input
                          type="time"
                          readOnly={readOnly}
                          aria-invalid={errors[at] ? true : undefined}
                          className="tabular-nums"
                          value={window.end}
                          onChange={(e) => {
                            const end = e.currentTarget.value;
                            setEditor((ed) => setWindow(ed, period.key, window.key, { end }));
                          }}
                        />
                      </Field.Root>
                      {readOnly ? null : (
                        <Button
                          variant="ghost"
                          density="compact"
                          aria-label={`Xoá khung ${j + 1} của đợt ${i + 1}`}
                          className="w-8 px-0"
                          onClick={() => removeRows((ed) => removeWindow(ed, period.key, window.key))}
                        >
                          <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                            <path d="m5 5 10 10M15 5 5 15" />
                          </svg>
                        </Button>
                      )}
                    </div>
                    {errors[at] ? (
                      <p id={`${at}-error`} role="alert" className="text-caption font-medium text-danger">
                        {`${n}: ${errors[at]}`}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            {readOnly || period.windows.length >= WINDOWS_MAX ? null : (
              <Button variant="ghost" density="compact" className="justify-self-start" onClick={() => addWindowAndFocus(period.key, i, period.windows.length)}>
                <span aria-hidden="true">+ </span>Thêm khung
              </Button>
            )}
          </fieldset>
        ))}

        {readOnly || editor.length >= PERIODS_MAX ? null : (
          <Button variant="ghost" density="compact" className="justify-self-start" onClick={addPeriodAndFocus}>
            <span aria-hidden="true">+ </span>Thêm đợt bán
          </Button>
        )}
        <p className="text-caption text-ink-muted">
          Khung giờ trong ngày, không qua nửa đêm, theo giờ chi nhánh. Lịch được xét theo giờ khách hẹn lấy: ngoài lịch, khách không
          đặt được món này cho giờ lấy đó.
        </p>

        {readOnly ? null : (
          <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-5">
            <Button
              variant="ghost"
              onClick={() => {
                save.reset();
                setLocal({});
                setEditor(scheduleEditorOf(base, newKey));
              }}
            >
              Bỏ thay đổi
            </Button>
            <Button type="submit" busy={save.isPending}>
              Lưu lịch bán
            </Button>
          </div>
        )}
      </form>
    </Card>
  );
}
