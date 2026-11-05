import type { BackofficeComponents } from "@hayi/api-client";

type Schemas = BackofficeComponents["schemas"];
export type FulfillmentConfig = Schemas["FulfillmentConfig"];
export type ScheduleWindow = Schemas["ScheduleWindow"];
export type ScheduleOverride = Schemas["ScheduleOverride"];
export type OverbookedSlot = Schemas["OverbookedSlot"];
type ProblemError = { field: string; code: string };

export interface Window {
  start: string;
  end: string;
}

/** One weekday: its pickup windows and the capacity of each slot in them (`""` = the config's default). */
export interface DaySchedule {
  windows: Window[];
  maxOrders: string;
  maxItems: string;
}

/** Index 0 = Monday … 6 = Sunday; `dayOfWeek` is index + 1 (ISO-8601). */
export type WeekSchedule = DaySchedule[];

const capacityText = (value: number | null | undefined) => (value == null ? "" : String(value));
const capacityValue = (text: string) => (text.trim() === "" ? null : Number(text));

/** Capacity is set per window by the API (Decision N4); the screen sets it per day, so the first window speaks for it. */
export function scheduleEditorOf(weekly: readonly ScheduleWindow[]): WeekSchedule {
  return Array.from({ length: 7 }, (_, index) => {
    const day = weekly.filter((w) => w.dayOfWeek === index + 1);
    return {
      windows: day.map(({ start, end }) => ({ start, end })),
      maxOrders: capacityText(day[0]?.maxOrders),
      maxItems: capacityText(day[0]?.maxItems),
    };
  });
}

/** Where each request item came from, to put `weekly[i]` errors back on their window. */
export type RequestPositions = { day: number; window: number }[];

export function weeklyScheduleRequest(week: WeekSchedule): { body: { weekly: ScheduleWindow[] }; at: RequestPositions } {
  const weekly: ScheduleWindow[] = [];
  const at: RequestPositions = [];
  week.forEach((day, dayIndex) => {
    day.windows.forEach((window, windowIndex) => {
      weekly.push({
        dayOfWeek: dayIndex + 1,
        start: window.start,
        end: window.end,
        maxOrders: capacityValue(day.maxOrders),
        maxItems: capacityValue(day.maxItems),
      });
      at.push({ day: dayIndex, window: windowIndex });
    });
  });
  return { body: { weekly }, at };
}

/** Why a window was refused, completing "Thứ Hai: khung 07:30–11:00 …" (Decision S6). */
export function windowErrorText(code: string): string {
  switch (code) {
    case "OUTSIDE_BRANCH_HOURS":
      return "nằm ngoài giờ mở cửa";
    case "OVERLAPPING":
      return "chồng lên một khung khác";
    case "START_NOT_BEFORE_END":
      return "có giờ bắt đầu không trước giờ kết thúc";
    default:
      return "chưa hợp lệ";
  }
}

export const capacityErrorText = "Tối đa phải từ 1 trở lên, hoặc để trống để dùng mặc định.";

/** Window errors by day, then window; capacity errors by day. */
export interface ScheduleErrors {
  windows: Record<number, Record<number, string>>;
  capacity: Record<number, string>;
}

export function scheduleErrors(errors: readonly ProblemError[], at: RequestPositions): ScheduleErrors {
  const result: ScheduleErrors = { windows: {}, capacity: {} };
  for (const error of errors) {
    const match = /^weekly\[(\d+)\](\.max(?:Orders|Items))?$/.exec(error.field);
    const position = match ? at[Number(match[1])] : undefined;
    if (!position) continue;
    if (match?.[2]) {
      result.capacity[position.day] ??= capacityErrorText;
    } else {
      (result.windows[position.day] ??= {})[position.window] ??= windowErrorText(error.code);
    }
  }
  return result;
}

/** Windows without both times: the request would only be refused, so they are marked first. */
export function missingWindowTimes(week: WeekSchedule): ScheduleErrors["windows"] {
  const result: ScheduleErrors["windows"] = {};
  week.forEach((day, dayIndex) => {
    day.windows.forEach((window, windowIndex) => {
      if (!window.start || !window.end) (result[dayIndex] ??= {})[windowIndex] = "chưa có giờ bắt đầu hoặc kết thúc";
    });
  });
  return result;
}

/** The rules panel (D3b screen 13) and the on/off switch; numbers as typed. */
export interface Rules {
  isEnabled: boolean;
  sameDayCutoffMinutes: string;
  maxAdvanceDays: string;
  slotDurationMinutes: string;
  customerCancelCutoffMinutes: string;
}

export function rulesOf(config: FulfillmentConfig): Rules {
  return {
    isEnabled: config.isEnabled,
    sameDayCutoffMinutes: String(config.sameDayCutoffMinutes),
    maxAdvanceDays: String(config.maxAdvanceDays),
    slotDurationMinutes: String(config.slotDurationMinutes),
    customerCancelCutoffMinutes: capacityText(config.customerCancelCutoffMinutes),
  };
}

/** `PUT configs/PICKUP` replaces the whole payload (R2): the fields this screen does not show keep their saved values. */
export function configRequest(saved: FulfillmentConfig, rules: Rules): Schemas["FulfillmentConfigInput"] {
  return {
    isEnabled: rules.isEnabled,
    asapEnabled: saved.asapEnabled,
    maxAdvanceDays: Number(rules.maxAdvanceDays),
    slotDurationMinutes: Number(rules.slotDurationMinutes),
    sameDayCutoffMinutes: Number(rules.sameDayCutoffMinutes),
    minLeadMinutes: saved.minLeadMinutes,
    groupOrderMinLeadMinutes: saved.groupOrderMinLeadMinutes,
    customerCancelCutoffMinutes: capacityValue(rules.customerCancelCutoffMinutes),
    defaultSlotMaxOrders: saved.defaultSlotMaxOrders,
    defaultSlotMaxItems: saved.defaultSlotMaxItems,
    pickupInstructions: saved.pickupInstructions,
  };
}
