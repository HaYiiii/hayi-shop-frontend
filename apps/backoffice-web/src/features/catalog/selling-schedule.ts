import { ApiError, type BackofficeComponents } from "@hayi/api-client";
import type { Product } from "./api/products";

type Schemas = BackofficeComponents["schemas"];
export type SellingSchedulesBody = Schemas["SellingSchedulesReplaceRequest"];

/** Limits of `PUT /products/{id}/selling-schedules` (Decision AK1). */
export const PERIODS_MAX = 10;
export const WINDOWS_MAX = 20;

/** Thứ in ISO order (1 = Monday); `""` = every day. */
export const dayOptions = [
  { value: "", label: "Mỗi ngày" },
  { value: "1", label: "Thứ 2" },
  { value: "2", label: "Thứ 3" },
  { value: "3", label: "Thứ 4" },
  { value: "4", label: "Thứ 5" },
  { value: "5", label: "Thứ 6" },
  { value: "6", label: "Thứ 7" },
  { value: "7", label: "Chủ nhật" },
] as const;

/** One time window as typed (HH:mm, Branch time, never over midnight). */
export interface WindowRow {
  key: string;
  day: string;
  start: string;
  end: string;
}

/** One selling period ("đợt bán", D3d screen 26): an optional date range and its windows (none = all day). */
export interface PeriodRow {
  key: string;
  startDate: string;
  endDate: string;
  windows: WindowRow[];
}

/** No period = sold whenever the Branch takes orders (AK1). */
export type ScheduleEditor = PeriodRow[];

/** `period-0.endDate`, `period-0.window-1`: where an error shows. */
export type ScheduleErrors = Partial<Record<string, string>>;

const hhmm = (time: string) => time.slice(0, 5);

export function scheduleEditorOf(product: Product, newKey: () => string): ScheduleEditor {
  return product.sellingSchedules.map((s) => ({
    key: newKey(),
    startDate: s.startDate ?? "",
    endDate: s.endDate ?? "",
    windows: s.windows.map((w) => ({ key: newKey(), day: w.dayOfWeek === null ? "" : String(w.dayOfWeek), start: hhmm(w.start), end: hhmm(w.end) })),
  }));
}

export function addPeriod(editor: ScheduleEditor, periodKey: string, windowKey: string): ScheduleEditor {
  if (editor.length >= PERIODS_MAX) return editor;
  return [...editor, { key: periodKey, startDate: "", endDate: "", windows: [{ key: windowKey, day: "", start: "", end: "" }] }];
}

export function removePeriod(editor: ScheduleEditor, periodKey: string): ScheduleEditor {
  return editor.filter((p) => p.key !== periodKey);
}

export function addWindow(editor: ScheduleEditor, periodKey: string, windowKey: string): ScheduleEditor {
  return editor.map((p) =>
    p.key === periodKey && p.windows.length < WINDOWS_MAX ? { ...p, windows: [...p.windows, { key: windowKey, day: "", start: "", end: "" }] } : p,
  );
}

export function removeWindow(editor: ScheduleEditor, periodKey: string, windowKey: string): ScheduleEditor {
  return editor.map((p) => (p.key === periodKey ? { ...p, windows: p.windows.filter((w) => w.key !== windowKey) } : p));
}

export function setPeriod(editor: ScheduleEditor, periodKey: string, change: Partial<Pick<PeriodRow, "startDate" | "endDate">>): ScheduleEditor {
  return editor.map((p) => (p.key === periodKey ? { ...p, ...change } : p));
}

export function setWindow(editor: ScheduleEditor, periodKey: string, windowKey: string, change: Partial<Omit<WindowRow, "key">>): ScheduleEditor {
  return editor.map((p) =>
    p.key === periodKey ? { ...p, windows: p.windows.map((w) => (w.key === windowKey ? { ...w, ...change } : w)) } : p,
  );
}

const sharesADay = (a: WindowRow, b: WindowRow) => a.day === "" || b.day === "" || a.day === b.day;

const messages = {
  RANGE_DATE: "Đến ngày phải từ ngày bắt đầu trở đi.",
  RANGE_TIME: "Giờ kết thúc phải sau giờ bắt đầu, không qua nửa đêm.",
  MISSING_TIME: "Nhập giờ bắt đầu và giờ kết thúc.",
  OVERLAP: "Khung này trùng giờ với một khung khác cùng ngày trong đợt.",
} as const;

/** The checks the server makes (AK1), shown at the row before sending. */
export function scheduleErrors(editor: ScheduleEditor): ScheduleErrors {
  const errors: ScheduleErrors = {};
  editor.forEach((period, i) => {
    if (period.startDate && period.endDate && period.endDate < period.startDate) errors[`period-${i}.endDate`] = messages.RANGE_DATE;
    period.windows.forEach((window, j) => {
      const at = `period-${i}.window-${j}`;
      if (!window.start || !window.end) errors[at] = messages.MISSING_TIME;
      else if (window.end <= window.start) errors[at] = messages.RANGE_TIME;
      else if (
        period.windows
          .slice(0, j)
          .some((earlier) => earlier.start && earlier.end && earlier.start < earlier.end && sharesADay(window, earlier) && window.start < earlier.end && earlier.start < window.end)
      ) {
        errors[at] = messages.OVERLAP;
      }
    });
  });
  return errors;
}

/** `PUT /products/{id}/selling-schedules`; call only when `scheduleErrors` is empty. */
export function schedulesBody(editor: ScheduleEditor): SellingSchedulesBody {
  return {
    schedules: editor.map((p) => ({
      startDate: p.startDate || null,
      endDate: p.endDate || null,
      windows: p.windows.map((w) => ({ dayOfWeek: w.day === "" ? null : Number(w.day), start: w.start, end: w.end })),
    })),
  };
}

const currentBody = (product: Product) => schedulesBody(scheduleEditorOf(product, () => ""));

/** Something typed is not on the server yet. */
export function scheduleEdited(editor: ScheduleEditor, product: Product): boolean {
  return JSON.stringify(schedulesBody(editor)) !== JSON.stringify(currentBody(product));
}

/** Two versions with the same schedules (another tab or a lifecycle command moved the version). */
export function sameSchedules(a: Product, b: Product): boolean {
  return JSON.stringify(currentBody(a)) === JSON.stringify(currentBody(b));
}

/** `422 CATALOG_SELLING_SCHEDULE_INVALID` `errors[]` (`schedules[i].endDate`, `schedules[i].windows[j]`) at their row. */
export function serverScheduleErrors(error: unknown): ScheduleErrors {
  if (!(error instanceof ApiError) || error.code !== "CATALOG_SELLING_SCHEDULE_INVALID") return {};
  const errors: ScheduleErrors = {};
  for (const e of error.problem.errors ?? []) {
    const date = /^schedules\[(\d+)\]\.endDate$/.exec(e.field);
    if (date) {
      errors[`period-${date[1]}.endDate`] ??= messages.RANGE_DATE;
      continue;
    }
    const window = /^schedules\[(\d+)\]\.windows\[(\d+)\]$/.exec(e.field);
    if (window) errors[`period-${window[1]}.window-${window[2]}`] ??= e.code === "OVERLAP" ? messages.OVERLAP : messages.RANGE_TIME;
  }
  return errors;
}
