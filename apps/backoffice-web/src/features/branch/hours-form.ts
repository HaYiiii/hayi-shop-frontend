import type { BackofficeComponents } from "@hayi/api-client";

type Schemas = BackofficeComponents["schemas"];
export type BranchBusinessHours = Schemas["BranchBusinessHours"];
export type HourOverride = Schemas["HourOverride"];
type WeeklyInterval = Schemas["WeeklyInterval"];
type ProblemError = { field: string; code: string; message?: string };

export interface Interval {
  open: string;
  close: string;
}

export interface DayHours {
  closed: boolean;
  /** Kept while the day is closed, so reopening it restores the hours. */
  intervals: Interval[];
}

/** Index 0 = Monday … 6 = Sunday; `dayOfWeek` is index + 1 (ISO-8601, API 09 §1.4). */
export type WeekEditor = DayHours[];

export const dayLabels = ["Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy", "Chủ nhật"] as const;

export const defaultInterval: Interval = { open: "07:00", close: "21:00" };

export function editorOf(weekly: readonly WeeklyInterval[]): WeekEditor {
  return dayLabels.map((_, index) => {
    const intervals = weekly.filter((w) => w.dayOfWeek === index + 1).map(({ open, close }) => ({ open, close }));
    return intervals.length > 0 ? { closed: false, intervals } : { closed: true, intervals: [{ ...defaultInterval }] };
  });
}

/** Where each request item came from, to put `weekly[i]` errors back on their row. */
export type RequestPositions = { day: number; interval: number }[];

/** `PUT business-hours` body: the open days' intervals; a closed day sends none (it is closed). */
export function weeklyRequest(week: WeekEditor): { body: { weekly: WeeklyInterval[] }; at: RequestPositions } {
  const weeklyItems: WeeklyInterval[] = [];
  const at: RequestPositions = [];
  week.forEach((day, dayIndex) => {
    if (day.closed) return;
    day.intervals.forEach((interval, intervalIndex) => {
      weeklyItems.push({ dayOfWeek: dayIndex + 1, open: interval.open, close: interval.close });
      at.push({ day: dayIndex, interval: intervalIndex });
    });
  });
  return { body: { weekly: weeklyItems }, at };
}

/** Problem `errors[].code` of `422 BRANCH_HOURS_INVALID` (Decision Q2) in words. */
export function hourErrorText(code: string): string {
  switch (code) {
    case "OPEN_NOT_BEFORE_CLOSE":
      return "Giờ mở phải trước giờ đóng (đóng muộn nhất 23:59).";
    case "OVERLAPPING":
      return "Khoảng này chồng lên một khoảng khác trong ngày. Sửa giờ để hai khoảng không trùng nhau.";
    case "DATE_IN_PAST":
      return "Ngày này đã qua. Chọn hôm nay hoặc một ngày sau.";
    case "OPEN_WITHOUT_INTERVALS":
    case "CLOSED_WITH_INTERVALS":
      return "Nhập giờ mở và giờ đóng, hoặc chọn Đóng cả ngày.";
    default:
      return "Giờ chưa hợp lệ. Kiểm tra lại giờ mở và giờ đóng.";
  }
}

/** Errors by day index, then interval index. */
export type WeeklyErrors = Record<number, Record<number, string>>;

export function weeklyErrors(errors: readonly ProblemError[], at: RequestPositions): WeeklyErrors {
  const result: WeeklyErrors = {};
  for (const error of errors) {
    const match = /^weekly\[(\d+)\]$/.exec(error.field);
    const position = match ? at[Number(match[1])] : undefined;
    if (!position) continue;
    const day = (result[position.day] ??= {});
    day[position.interval] ??= hourErrorText(error.code);
  }
  return result;
}

/** Open days' intervals missing a time: the request would only be refused, so they are marked before it. */
export function missingTimes(week: WeekEditor): WeeklyErrors {
  const result: WeeklyErrors = {};
  week.forEach((day, dayIndex) => {
    if (day.closed) return;
    day.intervals.forEach((interval, intervalIndex) => {
      if (interval.open && interval.close) return;
      (result[dayIndex] ??= {})[intervalIndex] = hourErrorText("OPEN_WITHOUT_INTERVALS");
    });
  });
  return result;
}

export function overrideErrors(errors: readonly ProblemError[]): { date?: string; time?: string } {
  const result: { date?: string; time?: string } = {};
  for (const error of errors) {
    const key = error.field === "date" ? "date" : error.field.startsWith("intervals") ? "time" : undefined;
    if (key) result[key] ??= hourErrorText(error.code);
  }
  return result;
}
