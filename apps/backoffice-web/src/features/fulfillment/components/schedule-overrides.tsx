import { ApiError } from "@hayi/api-client";
import { formatIsoDate, todayInBranch } from "@hayi/domain-utils";
import { Button, Field, cn, focusRing } from "@hayi/ui";
import { type FormEvent, useId, useState } from "react";
import { errorCode, useApi } from "../../../lib/api";
import { formText } from "../../../lib/form";
import { FormAlert } from "../../../lib/form-alert";
import { deleteOverride, putOverride } from "../api/fulfillment";
import { useScheduleMutation } from "../hooks/use-schedule-mutation";
import { type ScheduleOverride, type Window, capacityErrorText, windowErrorText } from "../schedule-form";

export type Notice = { tone: "success" | "danger"; text: string } | null;

const closedMeanwhile = "Chi nhánh đã đóng nên không sửa được khung giờ nhận đơn nữa. Tải lại trang để xem trạng thái mới nhất.";

function capacityText(o: ScheduleOverride) {
  const parts = [o.maxOrders === null ? null : `tối đa ${o.maxOrders} đơn`, o.maxItems === null ? null : `tối đa ${o.maxItems} ly`];
  return parts.filter(Boolean).join(", ");
}

interface ScheduleOverridesProps {
  branchId: string;
  /** From today on, by date then time; one per window (Decision S3, S4). */
  overrides: ScheduleOverride[];
  onNotice: (notice: Notice) => void;
  onReload: () => void;
}

/** "Ngày đặc biệt": a date's own windows win over the weekly schedule (Fulfillment §8.3). */
export function ScheduleOverrides({ branchId, overrides, onNotice, onReload }: ScheduleOverridesProps) {
  const api = useApi();
  const remove = useScheduleMutation(branchId, (o: ScheduleOverride) => deleteOverride(api, branchId, o.overrideId));

  function removeOverride(o: ScheduleOverride) {
    const date = formatIsoDate(o.date);
    const what = o.isClosed ? `ngày đặc biệt ${date}` : `khung ${o.start}–${o.end} ngày ${date}`;
    onNotice(null);
    remove.mutate(o, {
      onSuccess: () => onNotice({ tone: "success", text: `Đã xoá ${what}.` }),
      onError: (error) => {
        const code = errorCode(error);
        if (code === "FULFILLMENT_OVERRIDE_NOT_FOUND") {
          onNotice({ tone: "danger", text: `${what[0]?.toUpperCase()}${what.slice(1)} đã được xoá trước đó. Danh sách đã được tải lại.` });
          onReload();
        } else {
          onNotice({ tone: "danger", text: code === "BRANCH_INVALID_TRANSITION" ? closedMeanwhile : "Chưa xoá được. Bạn thử lại sau ít phút nhé." });
        }
      },
    });
  }

  return (
    <div className="grid gap-4">
      {overrides.length === 0 ? (
        <p className="text-label font-normal text-ink-muted">Chưa có ngày đặc biệt nào sắp tới.</p>
      ) : (
        <ul aria-label="Ngày đặc biệt sắp tới" className="grid gap-2">
          {overrides.map((o) => {
            const date = formatIsoDate(o.date);
            const capacity = capacityText(o);
            return (
              <li key={o.overrideId} className="flex items-start gap-2 rounded-md border border-line bg-paper px-3 py-2.5">
                <span className="grid min-w-0 flex-1">
                  <span className="text-body font-semibold tabular-nums">
                    {`${date} · `}
                    {o.isClosed ? <span className="text-danger">Không nhận đơn cả ngày</span> : `${o.start}–${o.end}`}
                    {capacity ? <span className="font-normal text-ink-muted">{` · ${capacity}`}</span> : null}
                  </span>
                  {o.reason ? <span className="break-words text-caption text-ink-muted">{o.reason}</span> : null}
                </span>
                <Button
                  variant="ghost"
                  density="compact"
                  className="size-8 shrink-0 px-0"
                  aria-label={o.isClosed ? `Xoá ngày đặc biệt ${date}` : `Xoá khung ${o.start}–${o.end} ngày ${date}`}
                  busy={remove.isPending && remove.variables?.overrideId === o.overrideId}
                  onClick={() => removeOverride(o)}
                >
                  <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                    <path d="m5 5 10 10M15 5 5 15" />
                  </svg>
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      <AddOverrideForm branchId={branchId} onNotice={onNotice} />
    </div>
  );
}

const timeClass = cn(
  "h-control-default w-auto min-w-[104px] rounded-md border border-line-strong bg-paper px-2 text-body tabular-nums text-ink",
  "hover:border-ink-muted aria-invalid:border-danger disabled:cursor-not-allowed disabled:bg-sunken disabled:text-ink-subtle",
  focusRing,
);

const firstWindow: Window = { start: "08:00", end: "12:00" };

interface OverrideErrors {
  date?: string;
  windows: Record<number, string>;
  intervals?: string;
  maxOrders?: string;
  maxItems?: string;
}

function overrideErrors(errors: readonly { field: string; code: string }[]): OverrideErrors {
  const result: OverrideErrors = { windows: {} };
  for (const error of errors) {
    const window = /^intervals\[(\d+)\]$/.exec(error.field);
    if (window) result.windows[Number(window[1])] ??= `Khung ${Number(window[1]) + 1} ${windowErrorText(error.code)}.`;
    else if (error.field === "date") result.date ??= error.code === "DATE_IN_PAST" ? "Ngày này đã qua. Chọn hôm nay hoặc một ngày sau." : "Ngày chưa hợp lệ.";
    else if (error.field === "intervals") result.intervals ??= "Nhập ít nhất một khung, hoặc chọn Không nhận đơn cả ngày.";
    else if (error.field === "maxOrders" || error.field === "maxItems") result[error.field] ??= capacityErrorText;
  }
  return result;
}

/** `POST overrides`: the same date again replaces its windows (Decision S3). */
function AddOverrideForm({ branchId, onNotice }: { branchId: string; onNotice: (notice: Notice) => void }) {
  const api = useApi();
  const titleId = useId();
  const errorId = useId();
  const [closed, setClosed] = useState(false);
  const [windows, setWindows] = useState<Window[]>([{ ...firstWindow }]);
  const add = useScheduleMutation(branchId, (body: Parameters<typeof putOverride>[2]) => putOverride(api, branchId, body));

  const refused = add.error instanceof ApiError && add.error.status === 422;
  const errors = refused ? overrideErrors((add.error as ApiError).problem.errors ?? []) : { windows: {} as Record<number, string> };
  const code = errorCode(add.error);
  const unexpected = add.isError && !refused;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const text = (name: string) => formText(form, name).trim();
    const number = (name: string) => (text(name) === "" ? null : Number(text(name)));
    const date = text("date");
    onNotice(null);
    add.mutate(
      {
        date,
        isClosed: closed,
        intervals: closed ? [] : windows,
        maxOrders: closed ? null : number("maxOrders"),
        maxItems: closed ? null : number("maxItems"),
        reason: text("reason") || null,
      },
      {
        onSuccess: () => {
          form.reset();
          setClosed(false);
          setWindows([{ ...firstWindow }]);
          onNotice({ tone: "success", text: `Đã lưu ngày đặc biệt ${formatIsoDate(date)}.` });
        },
        onError: (error) => {
          // After a refused save, the keyboard goes to the first field the server marked.
          if (!(error instanceof ApiError)) return;
          const marked = overrideErrors(error.problem.errors ?? []);
          const first = marked.date ? "date" : Object.keys(marked.windows).length > 0 ? `start-${Object.keys(marked.windows)[0]}` : undefined;
          const control = first ? form.elements.namedItem(first) : null;
          if (control instanceof HTMLElement) control.focus();
        },
      },
    );
  }

  return (
    <form aria-labelledby={titleId} className="grid gap-3 rounded-lg border border-line bg-paper p-4" onSubmit={submit}>
      <h3 id={titleId} className="text-body font-semibold">
        Thêm ngày đặc biệt
      </h3>
      {unexpected ? (
        <FormAlert tone="danger">
          {code === "BRANCH_INVALID_TRANSITION" ? closedMeanwhile : "Chưa lưu được ngày đặc biệt. Bạn thử lại sau ít phút nhé."}
        </FormAlert>
      ) : null}
      <Field.Root>
        <Field.Label>Ngày</Field.Label>
        <Field.Input name="date" type="date" autoComplete="off" required min={todayInBranch()} className="w-auto tabular-nums" />
        {errors.date ? <Field.Error>{errors.date}</Field.Error> : null}
      </Field.Root>
      <label className="flex cursor-pointer items-center gap-2 text-label">
        <input type="checkbox" className="size-[18px] accent-matcha-700" checked={closed} onChange={(e) => setClosed(e.target.checked)} />
        Không nhận đơn cả ngày
      </label>
      <fieldset disabled={closed} className="grid gap-2">
        <legend className="sr-only">Khung nhận đơn</legend>
        {windows.map((window, index) => {
          const n = index + 1;
          const invalid = errors.windows[index] !== undefined;
          const aria = invalid ? { "aria-invalid": true as const, "aria-describedby": `${errorId}-${index}` } : {};
          const set = (next: Partial<Window>) => setWindows((all) => all.map((w, i) => (i === index ? { ...w, ...next } : w)));
          return (
            <div key={index} className="grid gap-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <input
                  type="time"
                  name={`start-${index}`}
                  autoComplete="off"
                  required={!closed}
                  aria-label={`Khung ${n} bắt đầu`}
                  className={timeClass}
                  value={window.start}
                  onChange={(e) => set({ start: e.target.value })}
                  {...aria}
                />
                <span aria-hidden="true">–</span>
                <input
                  type="time"
                  name={`end-${index}`}
                  autoComplete="off"
                  required={!closed}
                  aria-label={`Khung ${n} kết thúc`}
                  className={timeClass}
                  value={window.end}
                  onChange={(e) => set({ end: e.target.value })}
                  {...aria}
                />
                {windows.length > 1 ? (
                  <Button
                    variant="ghost"
                    density="compact"
                    className="size-8 px-0"
                    aria-label={`Xoá khung ${n}`}
                    onClick={() => setWindows((all) => all.filter((_, i) => i !== index))}
                  >
                    <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                      <path d="m5 5 10 10M15 5 5 15" />
                    </svg>
                  </Button>
                ) : null}
              </div>
              {invalid ? (
                <p id={`${errorId}-${index}`} className="text-caption font-medium text-danger">
                  {errors.windows[index]}
                </p>
              ) : null}
            </div>
          );
        })}
        <Button variant="ghost" density="compact" className="justify-self-start" onClick={() => setWindows((all) => [...all, { start: "", end: "" }])}>
          + Thêm khung
        </Button>
        {errors.intervals ? <p className="text-caption font-medium text-danger">{errors.intervals}</p> : null}
        <div className="flex flex-wrap gap-3">
          <Field.Root>
            <Field.Label>Tối đa đơn</Field.Label>
            <Field.Input name="maxOrders" type="number" inputMode="numeric" min={1} step={1} autoComplete="off" className="w-24 tabular-nums" />
            {errors.maxOrders ? <Field.Error>{errors.maxOrders}</Field.Error> : null}
          </Field.Root>
          <Field.Root>
            <Field.Label>Tối đa ly</Field.Label>
            <Field.Input name="maxItems" type="number" inputMode="numeric" min={1} step={1} autoComplete="off" className="w-24 tabular-nums" />
            {errors.maxItems ? <Field.Error>{errors.maxItems}</Field.Error> : null}
          </Field.Root>
        </div>
      </fieldset>
      <Field.Root>
        <Field.Label>Lý do</Field.Label>
        <Field.Input name="reason" autoComplete="off" maxLength={255} placeholder="Ví dụ: Noel, nghỉ lễ…" />
        <Field.Hint>Để trống tối đa đơn/ly để dùng mặc định. Lưu một ngày đã có sẽ thay các khung cũ của ngày đó.</Field.Hint>
      </Field.Root>
      <Button type="submit" variant="outline" className="justify-self-start" busy={add.isPending}>
        Lưu ngày đặc biệt
      </Button>
    </form>
  );
}
