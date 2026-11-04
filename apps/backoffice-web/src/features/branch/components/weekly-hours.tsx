import { ApiError } from "@hayi/api-client";
import { Button, Table, cn, focusRing } from "@hayi/ui";
import { useEffect, useId, useRef, useState } from "react";
import { errorCode, useApi } from "../../../lib/api";
import { FormAlert } from "../../../lib/form-alert";
import { replaceWeekly } from "../api/hours";
import { useHoursMutation } from "../hooks/use-hours";
import {
  type DayHours,
  type Interval,
  type RequestPositions,
  type WeekEditor,
  type WeeklyErrors,
  dayLabels,
  defaultInterval,
  editorOf,
  missingTimes,
  weeklyErrors,
  weeklyRequest,
} from "../hours-form";
import { useBranchPage } from "./branch-detail";

type Weekly = Parameters<typeof editorOf>[0];

interface WeeklyHoursProps {
  branchId: string;
  weekly: Weekly;
  /** Current Branch version; it also moves with special days and lifecycle commands (Decision Q1). */
  version: number;
  readOnly: boolean;
  /** Fetches the hours again and starts the editor from them (after `412`). */
  onReload: () => void;
}

const sameWeekly = (a: Weekly, b: Weekly) => JSON.stringify(a) === JSON.stringify(b);

/** "Lịch hàng tuần": several intervals per day, a closed day has none; saved as a whole with `If-Match`. */
export function WeeklyHours({ branchId, weekly, version, readOnly, onReload }: WeeklyHoursProps) {
  const api = useApi();
  const { setNotice } = useBranchPage();
  // The server week the editor started from, and the version it was read at.
  const [basis, setBasis] = useState({ weekly, version });
  const [week, setWeek] = useState<WeekEditor>(() => editorOf(weekly));
  // Request positions of the last save, to put `weekly[i]` errors back on their row.
  const [sent, setSent] = useState<RequestPositions>([]);
  const [clientErrors, setClientErrors] = useState<WeeklyErrors | null>(null);
  const [attempt, setAttempt] = useState(0);
  const tableRef = useRef<HTMLDivElement>(null);
  const save = useHoursMutation(branchId, ({ body, ifMatch }: { body: ReturnType<typeof weeklyRequest>["body"]; ifMatch: number }) =>
    replaceWeekly(api, branchId, ifMatch, body),
  );

  // A newer version with the same week (a special day, a lifecycle command) is safe to save over: unsaved edits stay.
  // A different week from the server replaces an untouched editor; over edits, the old version makes the save a 412.
  const weeklyMoved = !sameWeekly(weekly, basis.weekly);
  const edited = JSON.stringify(week) !== JSON.stringify(editorOf(basis.weekly));
  if (weeklyMoved && !edited) {
    setBasis({ weekly, version });
    setWeek(editorOf(weekly));
  }
  const ifMatch = weeklyMoved ? basis.version : version;

  const code = errorCode(save.error);
  const errors: WeeklyErrors =
    clientErrors ??
    (save.error instanceof ApiError && code === "BRANCH_HOURS_INVALID" ? weeklyErrors(save.error.problem.errors ?? [], sent) : {});
  const badDays = Object.keys(errors).length;

  useEffect(() => {
    if (badDays === 0) return;
    // After a refused save, the keyboard goes to the first marked interval.
    tableRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [badDays, attempt]);

  /** `reshape`: intervals added, removed, opened or closed — the marks of the last save no longer point at the right rows. */
  function updateDay(dayIndex: number, change: (day: DayHours) => DayHours, reshape = false) {
    if (reshape) {
      setClientErrors(null);
      save.reset();
    }
    setWeek((current) => current.map((day, i) => (i === dayIndex ? change(day) : day)));
  }

  function submit() {
    setAttempt((n) => n + 1);
    setNotice(null);
    const missing = missingTimes(week);
    if (Object.keys(missing).length > 0) {
      save.reset();
      setClientErrors(missing);
      return;
    }
    setClientErrors(null);
    const { body, at } = weeklyRequest(week);
    setSent(at);
    save.mutate(
      { body, ifMatch },
      {
        onSuccess: (result) => {
          setBasis({ weekly: result.hours.weekly, version: result.version });
          setWeek(editorOf(result.hours.weekly));
          setNotice({ tone: "success", text: "Đã lưu lịch tuần." });
        },
      },
    );
  }

  return (
    <section aria-labelledby="weekly-hours-title" className="grid min-w-0 gap-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="weekly-hours-title" className="text-body-lg font-semibold">
          Lịch hàng tuần
        </h2>
        <span className="text-label font-normal text-ink-muted">Giờ Việt Nam</span>
        {readOnly ? null : (
          <Button density="compact" className="ml-auto" busy={save.isPending} onClick={submit}>
            Lưu lịch tuần
          </Button>
        )}
      </div>

      {badDays > 0 ? (
        <FormAlert tone="danger">
          {`Chưa lưu được: ${badDays} ngày có giờ không hợp lệ. Bạn sửa dòng được đánh dấu bên dưới.`}
        </FormAlert>
      ) : code === "VERSION_CONFLICT" ? (
        <ReloadAlert
          tone="warning"
          text="Giờ mở cửa vừa được người khác cập nhật. Thay đổi của bạn chưa được lưu. Tải lại để xem bản mới rồi sửa tiếp."
          onReload={() => {
            save.reset();
            onReload();
          }}
        />
      ) : code === "BRANCH_INVALID_TRANSITION" ? (
        <FormAlert tone="danger">Chi nhánh đã đóng nên không sửa được giờ mở cửa nữa. Tải lại trang để xem trạng thái mới nhất.</FormAlert>
      ) : code === "VALIDATION_FAILED" ? (
        <FormAlert tone="danger">Giờ chưa hợp lệ. Kiểm tra lại các ô giờ mở và giờ đóng rồi lưu lại.</FormAlert>
      ) : save.isError ? (
        <FormAlert tone="danger">Chưa lưu được lịch tuần. Bạn thử lại sau ít phút nhé.</FormAlert>
      ) : null}

      <div ref={tableRef}>
        <Table.Root aria-label="Lịch hàng tuần">
          <Table.Head>
            <Table.Row>
              <Table.HeaderCell className="w-[110px]">Ngày</Table.HeaderCell>
              <Table.HeaderCell>Khoảng giờ mở cửa</Table.HeaderCell>
              <Table.HeaderCell className="w-[140px]">Đóng cả ngày</Table.HeaderCell>
            </Table.Row>
          </Table.Head>
          <Table.Body>
            {week.map((day, dayIndex) => (
              <DayRow
                key={dayLabels[dayIndex]}
                label={dayLabels[dayIndex] ?? ""}
                day={day}
                errors={errors[dayIndex]}
                readOnly={readOnly}
                onChange={(change, reshape) => updateDay(dayIndex, change, reshape)}
              />
            ))}
          </Table.Body>
        </Table.Root>
      </div>
    </section>
  );
}

const timeClass = cn(
  "h-control-compact w-auto min-w-[96px] rounded-md border border-line-strong bg-paper px-2 text-body tabular-nums text-ink",
  "hover:border-ink-muted aria-invalid:border-danger disabled:cursor-not-allowed disabled:bg-sunken disabled:text-ink-subtle",
  focusRing,
);

interface DayRowProps {
  label: string;
  day: DayHours;
  errors: Record<number, string> | undefined;
  readOnly: boolean;
  onChange: (change: (day: DayHours) => DayHours, reshape?: boolean) => void;
}

function DayRow({ label, day, errors, readOnly, onChange }: DayRowProps) {
  const errorId = useId();
  const messages = errors ? Object.entries(errors) : [];

  function setTime(index: number, next: Partial<Interval>) {
    onChange((d) => ({ ...d, intervals: d.intervals.map((iv, i) => (i === index ? { ...iv, ...next } : iv)) }));
  }

  return (
    <Table.Row className={messages.length > 0 ? "bg-danger-soft [tbody_&]:hover:bg-danger-soft" : undefined}>
      <th scope="row" className="px-3 py-2 text-left align-top font-semibold">
        <span className="flex h-control-compact items-center">{label}</span>
      </th>
      <Table.Cell className="align-top">
        {day.closed ? (
          <span className="flex h-control-compact items-center text-ink-muted">Đóng cửa</span>
        ) : (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            {day.intervals.map((interval, index) => {
              const n = index + 1;
              const invalid = errors?.[index] !== undefined;
              const aria = invalid ? { "aria-invalid": true as const, "aria-describedby": `${errorId}-${index}` } : {};
              return (
                <span key={index} className="inline-flex items-center gap-1.5">
                  <input
                    type="time"
                    className={timeClass}
                    aria-label={`${label} khoảng ${n} mở`}
                    value={interval.open}
                    disabled={readOnly}
                    onChange={(e) => setTime(index, { open: e.target.value })}
                    {...aria}
                  />
                  <span aria-hidden="true">–</span>
                  <input
                    type="time"
                    className={timeClass}
                    aria-label={`${label} khoảng ${n} đóng`}
                    value={interval.close}
                    disabled={readOnly}
                    onChange={(e) => setTime(index, { close: e.target.value })}
                    {...aria}
                  />
                  {!readOnly && day.intervals.length > 1 ? (
                    <Button
                      variant="ghost"
                      density="compact"
                      className="size-8 px-0"
                      aria-label={`Xoá khoảng ${n} của ${label}`}
                      onClick={() => onChange((d) => ({ ...d, intervals: d.intervals.filter((_, i) => i !== index) }), true)}
                    >
                      <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                        <path d="m5 5 10 10M15 5 5 15" />
                      </svg>
                    </Button>
                  ) : null}
                </span>
              );
            })}
            {readOnly ? null : (
              <Button
                variant="ghost"
                density="compact"
                aria-label={`Thêm khoảng cho ${label}`}
                onClick={() => onChange((d) => ({ ...d, intervals: [...d.intervals, { ...defaultInterval }] }), true)}
              >
                + Thêm khoảng
              </Button>
            )}
          </div>
        )}
        {messages.map(([index, message]) => (
          <p key={index} id={`${errorId}-${index}`} className="mt-1.5 text-caption font-medium text-danger">
            {day.intervals.length > 1 ? `Khoảng ${Number(index) + 1}: ${message}` : message}
          </p>
        ))}
      </Table.Cell>
      <Table.Cell className="align-top">
        <label className="flex h-control-compact cursor-pointer items-center gap-2 text-label">
          <input
            type="checkbox"
            className="size-[18px] accent-matcha-700"
            checked={day.closed}
            disabled={readOnly}
            onChange={(e) => onChange((d) => ({ ...d, closed: e.target.checked }), true)}
          />
          Đóng<span className="sr-only">{` cả ngày ${label}`}</span>
        </label>
      </Table.Cell>
    </Table.Row>
  );
}

function ReloadAlert({ tone, text, onReload }: { tone: "warning" | "danger"; text: string; onReload: () => void }) {
  return (
    <div className="grid justify-items-start gap-2">
      <FormAlert tone={tone}>{text}</FormAlert>
      <Button variant="outline" density="compact" onClick={onReload}>
        Tải lại
      </Button>
    </div>
  );
}
