import { ApiError } from "@hayi/api-client";
import { formatIsoDate, todayInBranch } from "@hayi/domain-utils";
import { Button, Card, Field, cn, focusRing } from "@hayi/ui";
import { type FormEvent, useId, useState } from "react";
import { errorCode, useApi } from "../../../lib/api";
import { formText } from "../../../lib/form";
import { FormAlert } from "../../../lib/form-alert";
import { deleteOverride, putOverride } from "../api/hours";
import { useHoursMutation } from "../hooks/use-hours";
import { type HourOverride, overrideErrors } from "../hours-form";
import { useBranchPage } from "./branch-detail";

interface HourOverridesProps {
  branchId: string;
  /** From today on, sorted by date (Decision Q4). */
  overrides: HourOverride[];
  readOnly: boolean;
  onReload: () => void;
}

function hoursText(override: HourOverride) {
  return override.isClosed ? null : override.intervals.map((iv) => `${iv.open}–${iv.close}`).join(", ");
}

/** "Ngày đặc biệt": a date's own hours win over the weekly schedule (Decision Q5). */
export function HourOverrides({ branchId, overrides, readOnly, onReload }: HourOverridesProps) {
  const api = useApi();
  const { setNotice } = useBranchPage();
  const listId = useId();
  const remove = useHoursMutation(branchId, (date: string) => deleteOverride(api, branchId, date));

  function removeDay(date: string) {
    setNotice(null);
    remove.mutate(date, {
      onSuccess: () => setNotice({ tone: "success", text: `Đã xoá ngày đặc biệt ${formatIsoDate(date)}.` }),
      onError: (error) => {
        if (errorCode(error) === "BRANCH_HOURS_OVERRIDE_NOT_FOUND") {
          setNotice({ tone: "danger", text: `Ngày đặc biệt ${formatIsoDate(date)} đã được xoá trước đó. Danh sách đã được tải lại.` });
          onReload();
        } else {
          setNotice({ tone: "danger", text: "Chưa xoá được ngày đặc biệt. Bạn thử lại sau ít phút nhé." });
        }
      },
    });
  }

  return (
    <Card aria-labelledby={`${listId}-title`} role="complementary" className="gap-3.5 p-5">
      <h2 id={`${listId}-title`} className="text-body-lg font-semibold">
        Ngày đặc biệt
      </h2>
      {overrides.length === 0 ? (
        <p className="text-label font-normal text-ink-muted">Chưa có ngày đặc biệt nào sắp tới.</p>
      ) : (
        <ul aria-label="Ngày đặc biệt sắp tới" className="grid gap-2">
          {overrides.map((override) => {
            const date = formatIsoDate(override.date);
            const hours = hoursText(override);
            return (
              <li key={override.date} className="flex items-start gap-2 rounded-md border border-line px-3 py-2.5">
                <span className="grid min-w-0 flex-1">
                  <span className="text-body font-semibold tabular-nums">
                    {`${date} · `}
                    {hours ?? <span className="text-danger">Đóng cả ngày</span>}
                  </span>
                  {override.reason ? <span className="break-words text-caption text-ink-muted">{override.reason}</span> : null}
                </span>
                {readOnly ? null : (
                  <Button
                    variant="ghost"
                    density="compact"
                    className="size-8 shrink-0 px-0"
                    aria-label={`Xoá ngày đặc biệt ${date}`}
                    busy={remove.isPending && remove.variables === override.date}
                    onClick={() => removeDay(override.date)}
                  >
                    <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                      <path d="m5 5 10 10M15 5 5 15" />
                    </svg>
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {readOnly ? null : <AddOverrideForm branchId={branchId} />}
      <p className="text-caption text-ink-muted">Ngày đặc biệt được ưu tiên hơn lịch tuần.</p>
    </Card>
  );
}

const timeClass = cn(
  "h-control-default w-auto min-w-[104px] rounded-md border border-line-strong bg-paper px-2 text-body tabular-nums text-ink",
  "hover:border-ink-muted aria-invalid:border-danger disabled:cursor-not-allowed disabled:bg-sunken disabled:text-ink-subtle",
  focusRing,
);

/** `POST business-hour-overrides`: the same date again replaces its hours (Decision Q3). */
function AddOverrideForm({ branchId }: { branchId: string }) {
  const api = useApi();
  const { setNotice } = useBranchPage();
  const titleId = useId();
  const timeErrorId = useId();
  const [closed, setClosed] = useState(false);
  const add = useHoursMutation(branchId, (body: Parameters<typeof putOverride>[2]) => putOverride(api, branchId, body));

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const text = (name: string) => formText(form, name).trim();
    const date = text("date");
    setNotice(null);
    add.mutate(
      {
        date,
        isClosed: closed,
        intervals: closed ? [] : [{ open: text("open"), close: text("close") }],
        reason: text("reason") || null,
      },
      {
        onSuccess: () => {
          form.reset();
          setClosed(false);
          setNotice({ tone: "success", text: `Đã lưu ngày đặc biệt ${formatIsoDate(date)}.` });
        },
        onError: (error) => {
          // After a refused save, the keyboard goes to the first field the server marked.
          const marked = error instanceof ApiError ? overrideErrors(error.problem.errors ?? []) : {};
          const first = marked.date ? "date" : marked.time ? "open" : undefined;
          const control = first ? form.elements.namedItem(first) : null;
          if (control instanceof HTMLElement) control.focus();
        },
      },
    );
  }

  const errors = add.error instanceof ApiError && errorCode(add.error) === "BRANCH_HOURS_INVALID" ? overrideErrors(add.error.problem.errors ?? []) : {};
  const unexpected = add.isError && Object.keys(errors).length === 0;

  return (
    <form aria-labelledby={titleId} className="grid gap-2.5 border-t border-line pt-3" onSubmit={submit}>
      <h3 id={titleId} className="text-body font-semibold">
        Thêm ngày
      </h3>
      {unexpected ? <FormAlert tone="danger">Chưa lưu được ngày đặc biệt. Bạn thử lại sau ít phút nhé.</FormAlert> : null}
      <Field.Root>
        <Field.Label>Ngày</Field.Label>
        <Field.Input name="date" type="date" autoComplete="off" required min={todayInBranch()} className="tabular-nums" />
        {errors.date ? <Field.Error>{errors.date}</Field.Error> : null}
      </Field.Root>
      <label className="flex cursor-pointer items-center gap-2 text-label">
        <input type="checkbox" className="size-[18px] accent-matcha-700" checked={closed} onChange={(e) => setClosed(e.target.checked)} />
        Đóng cả ngày
      </label>
      <div className="grid gap-1.5">
        <div className="flex items-center gap-1.5">
          <input
            type="time"
            name="open"
            autoComplete="off"
            defaultValue="08:00"
            required={!closed}
            disabled={closed}
            aria-label="Giờ mở ngày đặc biệt"
            aria-invalid={errors.time ? true : undefined}
            aria-describedby={errors.time ? timeErrorId : undefined}
            className={timeClass}
          />
          <span aria-hidden="true">–</span>
          <input
            type="time"
            name="close"
            autoComplete="off"
            defaultValue="22:00"
            required={!closed}
            disabled={closed}
            aria-label="Giờ đóng ngày đặc biệt"
            aria-invalid={errors.time ? true : undefined}
            aria-describedby={errors.time ? timeErrorId : undefined}
            className={timeClass}
          />
        </div>
        {errors.time ? (
          <p id={timeErrorId} className="text-caption font-medium text-danger">
            {errors.time}
          </p>
        ) : null}
      </div>
      <Field.Root>
        <Field.Label>Lý do</Field.Label>
        <Field.Input name="reason" autoComplete="off" maxLength={255} placeholder="Ví dụ: Giáng sinh, mở muộn…" />
        <Field.Hint>Thêm một ngày đã có sẽ thay giờ cũ của ngày đó.</Field.Hint>
      </Field.Root>
      <Button type="submit" variant="outline" busy={add.isPending}>
        Thêm ngày đặc biệt
      </Button>
    </form>
  );
}
