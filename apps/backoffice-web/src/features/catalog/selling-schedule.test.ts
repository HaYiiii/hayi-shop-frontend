import { ApiError } from "@hayi/api-client";
import { describe, expect, it } from "vitest";
import {
  addPeriod,
  addWindow,
  removePeriod,
  sameSchedules,
  scheduleEdited,
  scheduleEditorOf,
  scheduleErrors,
  schedulesBody,
  serverScheduleErrors,
  setPeriod,
  setWindow,
} from "./selling-schedule";
import { aProduct } from "./test/products";

let n = 0;
const key = () => `k${++n}`;

const scheduled = aProduct({
  sellingSchedules: [{ startDate: "2026-12-01", endDate: "2026-12-31", windows: [{ dayOfWeek: null, start: "07:00", end: "14:00" }] }],
});

describe("scheduleEditorOf / schedulesBody", () => {
  it("round-trips the Product's schedules; empty optional dates become null", () => {
    const editor = scheduleEditorOf(scheduled, key);
    expect(editor[0]).toMatchObject({ startDate: "2026-12-01", endDate: "2026-12-31" });
    expect(editor[0]!.windows[0]).toMatchObject({ day: "", start: "07:00", end: "14:00" });
    expect(scheduleEdited(editor, scheduled)).toBe(false);

    let next = addPeriod(editor, "p2", "w2");
    next = setWindow(next, "p2", "w2", { day: "6", start: "08:00", end: "12:00" });
    expect(schedulesBody(next).schedules[1]).toEqual({ startDate: null, endDate: null, windows: [{ dayOfWeek: 6, start: "08:00", end: "12:00" }] });
    expect(scheduleEdited(next, scheduled)).toBe(true);
    expect(schedulesBody(removePeriod(next, "p2"))).toEqual(schedulesBody(editor));
  });

  it("no period means sold whenever the Branch takes orders", () => {
    expect(schedulesBody(scheduleEditorOf(aProduct(), key))).toEqual({ schedules: [] });
  });

  it("a newer version with the same schedules counts as the same", () => {
    expect(sameSchedules(scheduled, { ...scheduled, version: 9, status: "INACTIVE" })).toBe(true);
    expect(sameSchedules(scheduled, aProduct())).toBe(false);
  });
});

describe("scheduleErrors (AK1)", () => {
  it("checks dates, times and overlaps on a shared day", () => {
    let editor = addPeriod([], "p", "w1");
    editor = setPeriod(editor, "p", { startDate: "2026-12-10", endDate: "2026-12-01" });
    editor = setWindow(editor, "p", "w1", { start: "07:00", end: "11:00" });
    editor = addWindow(editor, "p", "w2");
    editor = setWindow(editor, "p", "w2", { day: "6", start: "10:00", end: "12:00" });
    editor = addWindow(editor, "p", "w3");
    editor = setWindow(editor, "p", "w3", { start: "15:00", end: "14:00" });
    editor = addWindow(editor, "p", "w4");
    expect(scheduleErrors(editor)).toEqual({
      "period-0.endDate": "Đến ngày phải từ ngày bắt đầu trở đi.",
      "period-0.window-1": "Khung này trùng giờ với một khung khác cùng ngày trong đợt.",
      "period-0.window-2": "Giờ kết thúc phải sau giờ bắt đầu, không qua nửa đêm.",
      "period-0.window-3": "Nhập giờ bắt đầu và giờ kết thúc.",
    });
  });

  it("windows on different days may share hours", () => {
    let editor = addPeriod([], "p", "w1");
    editor = setWindow(editor, "p", "w1", { day: "1", start: "07:00", end: "11:00" });
    editor = addWindow(editor, "p", "w2");
    editor = setWindow(editor, "p", "w2", { day: "2", start: "07:00", end: "11:00" });
    expect(scheduleErrors(editor)).toEqual({});
  });
});

describe("serverScheduleErrors", () => {
  it("puts CATALOG_SELLING_SCHEDULE_INVALID errors[] on their row", () => {
    const error = new ApiError({
      status: 422,
      code: "CATALOG_SELLING_SCHEDULE_INVALID",
      errors: [
        { field: "schedules[0].endDate", code: "RANGE" },
        { field: "schedules[1].windows[2]", code: "OVERLAP" },
      ],
    });
    expect(serverScheduleErrors(error)).toEqual({
      "period-0.endDate": "Đến ngày phải từ ngày bắt đầu trở đi.",
      "period-1.window-2": "Khung này trùng giờ với một khung khác cùng ngày trong đợt.",
    });
  });
});
