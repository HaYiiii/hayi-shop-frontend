import { describe, expect, it } from "vitest";
import {
  configRequest,
  mixedCapacityDays,
  missingWindowTimes,
  rulesOf,
  scheduleEditorOf,
  scheduleErrors,
  weeklyScheduleRequest,
} from "./schedule-form";

const weekly = [
  { dayOfWeek: 1, start: "07:30", end: "11:00", maxOrders: 8, maxItems: 20 },
  { dayOfWeek: 1, start: "13:30", end: "21:00", maxOrders: 8, maxItems: 20 },
  { dayOfWeek: 7, start: "08:30", end: "17:00", maxOrders: null, maxItems: null },
];

const config = {
  fulfillmentType: "PICKUP" as const,
  isEnabled: false,
  asapEnabled: false,
  maxAdvanceDays: 7,
  slotDurationMinutes: 15,
  sameDayCutoffMinutes: 180,
  minLeadMinutes: 30,
  groupOrderMinLeadMinutes: 120,
  customerCancelCutoffMinutes: null,
  defaultSlotMaxOrders: 15,
  defaultSlotMaxItems: null,
  pickupInstructions: "Nhận tại quầy bên trái",
  version: 3,
  overbookedSlots: [],
};

describe("scheduleEditorOf — weekly windows as seven days (Monday first, Decision N4)", () => {
  it("groups windows by day with the day's capacity; a day without windows takes no orders", () => {
    const week = scheduleEditorOf(weekly);

    expect(week).toHaveLength(7);
    expect(week[0]).toEqual({
      windows: [
        { start: "07:30", end: "11:00" },
        { start: "13:30", end: "21:00" },
      ],
      maxOrders: "8",
      maxItems: "20",
    });
    expect(week[1]).toEqual({ windows: [], maxOrders: "", maxItems: "" });
    // null capacity = the config's default: an empty field.
    expect(week[6]).toEqual({ windows: [{ start: "08:30", end: "17:00" }], maxOrders: "", maxItems: "" });
  });
});

describe("weeklyScheduleRequest — `PUT weekly-schedule` body (API 09 §2.2)", () => {
  it("sends every window with its day's capacity (empty = null) and where each came from", () => {
    const week = scheduleEditorOf(weekly);
    week[6] = { ...week[6]!, maxOrders: "10" };

    const { body, at } = weeklyScheduleRequest(week);

    expect(body).toEqual({
      weekly: [
        { dayOfWeek: 1, start: "07:30", end: "11:00", maxOrders: 8, maxItems: 20 },
        { dayOfWeek: 1, start: "13:30", end: "21:00", maxOrders: 8, maxItems: 20 },
        { dayOfWeek: 7, start: "08:30", end: "17:00", maxOrders: 10, maxItems: null },
      ],
    });
    expect(at).toEqual([
      { day: 0, window: 0 },
      { day: 0, window: 1 },
      { day: 6, window: 0 },
    ]);
  });
});

describe("scheduleErrors — `errors[]` of a 422 onto the right day and window (Decision S6)", () => {
  const at = [
    { day: 0, window: 0 },
    { day: 6, window: 0 },
    { day: 6, window: 1 },
  ];

  it("marks windows by weekly[i] and capacities by weekly[i].maxOrders/maxItems", () => {
    const errors = scheduleErrors(
      [
        { field: "weekly[2]", code: "OUTSIDE_BRANCH_HOURS" },
        { field: "weekly[0]", code: "OVERLAPPING" },
        { field: "weekly[1].maxItems", code: "BELOW_ONE" },
      ],
      at,
    );

    expect(errors.windows).toEqual({
      6: { 1: "nằm ngoài giờ mở cửa" },
      0: { 0: "chồng lên một khung khác" },
    });
    expect(errors.capacity).toEqual({ 6: "Tối đa phải từ 1 trở lên, hoặc để trống để dùng mặc định." });
  });

  it("ignores a field it cannot place", () => {
    expect(scheduleErrors([{ field: "weekly", code: "X" }], [])).toEqual({ windows: {}, capacity: {} });
  });
});

describe("missingWindowTimes — a window without both times is stopped before the request", () => {
  it("marks each window missing a time", () => {
    const week = scheduleEditorOf(weekly);
    week[0] = { ...week[0]!, windows: [{ start: "07:30", end: "11:00" }, { start: "", end: "21:00" }] };

    expect(missingWindowTimes(week)).toEqual({ 0: { 1: "chưa có giờ bắt đầu hoặc kết thúc" } });
    expect(missingWindowTimes(scheduleEditorOf(weekly))).toEqual({});
  });
});

describe("rulesOf / configRequest — the rules panel over `PUT configs/PICKUP` (API 09 §2.1)", () => {
  it("edits five fields and keeps the others as saved", () => {
    const rules = { ...rulesOf(config), isEnabled: true, sameDayCutoffMinutes: "120", customerCancelCutoffMinutes: "60" };

    expect(rulesOf(config)).toEqual({
      isEnabled: false,
      sameDayCutoffMinutes: "180",
      maxAdvanceDays: "7",
      slotDurationMinutes: "15",
      customerCancelCutoffMinutes: "",
    });
    expect(configRequest(config, rules)).toEqual({
      isEnabled: true,
      asapEnabled: false,
      maxAdvanceDays: 7,
      slotDurationMinutes: 15,
      sameDayCutoffMinutes: 120,
      minLeadMinutes: 30,
      groupOrderMinLeadMinutes: 120,
      customerCancelCutoffMinutes: 60,
      defaultSlotMaxOrders: 15,
      defaultSlotMaxItems: null,
      pickupInstructions: "Nhận tại quầy bên trái",
    });
  });

  it("sends an empty cancel cutoff as null", () => {
    expect(configRequest(config, rulesOf(config)).customerCancelCutoffMinutes).toBeNull();
  });
});

describe("mixedCapacityDays — days whose windows carry different capacities", () => {
  it("names them, since the screen sets one capacity per day", () => {
    expect(mixedCapacityDays(weekly)).toEqual(new Set());
    expect(
      mixedCapacityDays([
        { dayOfWeek: 3, start: "07:00", end: "09:00", maxOrders: 8, maxItems: null },
        { dayOfWeek: 3, start: "10:00", end: "12:00", maxOrders: 9, maxItems: null },
      ]),
    ).toEqual(new Set([2]));
  });
});
