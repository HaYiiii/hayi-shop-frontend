import { Button, Table, cn, focusRing } from "@hayi/ui";
import { useId } from "react";
import { dayLabels } from "../../branch/hours-form";
import type { DaySchedule, ScheduleErrors, WeekSchedule, Window } from "../schedule-form";

/** A new window starts with a whole working day; the editor fixes it before saving. */
export const defaultWindow: Window = { start: "07:30", end: "21:00" };

export type DayChange = (change: (day: DaySchedule) => DaySchedule, reshape?: boolean) => void;

interface WeeklyScheduleProps {
  week: WeekSchedule;
  /** The Branch's opening hours per day, to compare with (read-only here). */
  openingHours: (dayIndex: number) => string;
  slotMinutes: string;
  errors: ScheduleErrors;
  /** Days whose saved windows carry different capacities (the screen sets one per day). */
  mixedCapacity: ReadonlySet<number>;
  onDayChange: (dayIndex: number) => DayChange;
}

const inputClass = cn(
  "h-control-compact rounded-md border border-line-strong bg-paper px-2 text-body tabular-nums text-ink",
  "hover:border-ink-muted aria-invalid:border-danger aria-invalid:bg-danger-soft",
  focusRing,
);

/** "Lịch hàng tuần": pickup windows per day; slots are generated from them (Decision N4). */
export function WeeklySchedule({ week, openingHours, slotMinutes, errors, mixedCapacity, onDayChange }: WeeklyScheduleProps) {
  return (
    <Table.Root aria-label="Lịch nhận đơn hàng tuần">
      <Table.Head>
        <Table.Row>
          <Table.HeaderCell className="whitespace-nowrap">Ngày</Table.HeaderCell>
          <Table.HeaderCell className="whitespace-nowrap">Giờ mở cửa</Table.HeaderCell>
          <Table.HeaderCell>Khung nhận đơn</Table.HeaderCell>
          <Table.HeaderCell className="whitespace-nowrap">Mỗi khung</Table.HeaderCell>
          <Table.HeaderCell className="whitespace-nowrap">Tối đa đơn</Table.HeaderCell>
          <Table.HeaderCell className="whitespace-nowrap">Tối đa ly</Table.HeaderCell>
        </Table.Row>
      </Table.Head>
      <Table.Body>
        {week.map((day, dayIndex) => (
          <DayRow
            key={dayLabels[dayIndex]}
            label={dayLabels[dayIndex] ?? ""}
            day={day}
            openingHours={openingHours(dayIndex)}
            slotMinutes={slotMinutes}
            windowErrors={errors.windows[dayIndex]}
            capacityError={errors.capacity[dayIndex]}
            mixedCapacity={mixedCapacity.has(dayIndex)}
            onChange={onDayChange(dayIndex)}
          />
        ))}
      </Table.Body>
    </Table.Root>
  );
}

interface DayRowProps {
  label: string;
  day: DaySchedule;
  openingHours: string;
  slotMinutes: string;
  windowErrors: Record<number, string> | undefined;
  capacityError: string | undefined;
  mixedCapacity: boolean;
  onChange: DayChange;
}

function DayRow({ label, day, openingHours, slotMinutes, windowErrors, capacityError, mixedCapacity, onChange }: DayRowProps) {
  const errorId = useId();
  const messages = windowErrors ? Object.entries(windowErrors) : [];
  const marked = messages.length > 0 || capacityError !== undefined;

  function setTime(index: number, next: Partial<Window>) {
    onChange((d) => ({ ...d, windows: d.windows.map((w, i) => (i === index ? { ...w, ...next } : w)) }));
  }

  return (
    <Table.Row className={marked ? "bg-danger-soft [tbody_&]:hover:bg-danger-soft" : undefined}>
      <th scope="row" className="px-3 py-2 text-left align-top font-semibold whitespace-nowrap">
        <span className="flex h-control-compact items-center">{label}</span>
      </th>
      <Table.Cell className="align-top whitespace-nowrap tabular-nums text-ink-muted">
        <span className="flex min-h-control-compact items-center">{openingHours}</span>
      </Table.Cell>
      <Table.Cell className="align-top">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {day.windows.length === 0 ? <span className="flex h-control-compact items-center text-ink-muted">Không nhận đơn</span> : null}
          {day.windows.map((window, index) => {
            const n = index + 1;
            const aria = windowErrors?.[index] !== undefined ? { "aria-invalid": true as const, "aria-describedby": `${errorId}-${index}` } : {};
            return (
              <span key={index} className="inline-flex items-center gap-1.5">
                <input
                  type="time"
                  autoComplete="off"
                  className={cn(inputClass, "w-auto min-w-[96px]")}
                  aria-label={`${label} khung ${n} bắt đầu`}
                  value={window.start}
                  onChange={(e) => setTime(index, { start: e.target.value })}
                  {...aria}
                />
                <span aria-hidden="true">–</span>
                <input
                  type="time"
                  autoComplete="off"
                  className={cn(inputClass, "w-auto min-w-[96px]")}
                  aria-label={`${label} khung ${n} kết thúc`}
                  value={window.end}
                  onChange={(e) => setTime(index, { end: e.target.value })}
                  {...aria}
                />
                <Button
                  variant="ghost"
                  density="compact"
                  className="size-8 px-0"
                  aria-label={`Xoá khung ${n} của ${label}`}
                  onClick={() => onChange((d) => ({ ...d, windows: d.windows.filter((_, i) => i !== index) }), true)}
                >
                  <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                    <path d="m5 5 10 10M15 5 5 15" />
                  </svg>
                </Button>
              </span>
            );
          })}
          <Button
            variant="ghost"
            density="compact"
            aria-label={`Thêm khung cho ${label}`}
            onClick={() => onChange((d) => ({ ...d, windows: [...d.windows, { ...defaultWindow }] }), true)}
          >
            + Thêm khung
          </Button>
        </div>
        {messages.map(([index, message]) => (
          <p key={index} id={`${errorId}-${index}`} className="mt-1.5 text-caption font-medium text-danger">
            {`Khung ${Number(index) + 1} ${message}.`}
          </p>
        ))}
        {capacityError ? <p className="mt-1.5 text-caption font-medium text-danger">{capacityError}</p> : null}
        {mixedCapacity ? (
          <p className="mt-1.5 text-caption font-medium text-warning">
            Các khung trong ngày đang có sức chứa khác nhau; lưu sẽ áp một mức cho cả ngày.
          </p>
        ) : null}
      </Table.Cell>
      <Table.Cell className="align-top whitespace-nowrap tabular-nums">
        <span className="flex h-control-compact items-center">{`${slotMinutes} phút`}</span>
      </Table.Cell>
      {(["maxOrders", "maxItems"] as const).map((field) => (
        <Table.Cell key={field} className="align-top">
          <input
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            autoComplete="off"
            placeholder="Mặc định"
            className={cn(inputClass, "w-24")}
            aria-label={`${field === "maxOrders" ? "Tối đa đơn" : "Tối đa ly"} ${label}`}
            aria-invalid={capacityError ? true : undefined}
            value={day[field]}
            onChange={(e) => onChange((d) => ({ ...d, [field]: e.target.value }))}
          />
        </Table.Cell>
      ))}
    </Table.Row>
  );
}
