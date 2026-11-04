import { describe, expect, it } from "vitest";
import { editorOf, overrideErrors, weeklyErrors, weeklyRequest } from "./hours-form";

const weekly = [
  { dayOfWeek: 1, open: "07:00", close: "11:30" },
  { dayOfWeek: 1, open: "13:00", close: "21:00" },
  { dayOfWeek: 5, open: "07:00", close: "22:00" },
];

describe("editorOf — the API's weekly intervals as seven days (Monday first)", () => {
  it("groups intervals by day; a day without intervals is closed", () => {
    const week = editorOf(weekly);

    expect(week).toHaveLength(7);
    expect(week[0]).toEqual({ closed: false, intervals: [{ open: "07:00", close: "11:30" }, { open: "13:00", close: "21:00" }] });
    expect(week[4]).toEqual({ closed: false, intervals: [{ open: "07:00", close: "22:00" }] });
    // A closed day keeps one interval ready for when it is opened again.
    expect(week[1]).toEqual({ closed: true, intervals: [{ open: "07:00", close: "21:00" }] });
  });
});

describe("weeklyRequest — `PUT business-hours` body (API 09 §1.4)", () => {
  it("sends the intervals of open days with ISO day numbers and leaves closed days out", () => {
    const week = editorOf(weekly);
    week[0] = { closed: true, intervals: week[0]!.intervals };
    week[6] = { closed: false, intervals: [{ open: "08:00", close: "21:30" }] };

    const { body, at } = weeklyRequest(week);

    expect(body).toEqual({
      weekly: [
        { dayOfWeek: 5, open: "07:00", close: "22:00" },
        { dayOfWeek: 7, open: "08:00", close: "21:30" },
      ],
    });
    expect(at).toEqual([
      { day: 4, interval: 0 },
      { day: 6, interval: 0 },
    ]);
  });
});

describe("weeklyErrors — `errors[]` of 422 BRANCH_HOURS_INVALID onto the right day and interval", () => {
  it("maps weekly[i] through the request positions and words each code", () => {
    const at = [
      { day: 4, interval: 0 },
      { day: 4, interval: 1 },
      { day: 6, interval: 0 },
    ];

    const errors = weeklyErrors(
      [
        { field: "weekly[1]", code: "OVERLAPPING" },
        { field: "weekly[2]", code: "OPEN_NOT_BEFORE_CLOSE" },
      ],
      at,
    );

    expect(errors).toEqual({
      4: { 1: "Khoảng này chồng lên một khoảng khác trong ngày. Sửa giờ để hai khoảng không trùng nhau." },
      6: { 0: "Giờ mở phải trước giờ đóng (đóng muộn nhất 23:59)." },
    });
  });

  it("ignores a field it cannot place", () => {
    expect(weeklyErrors([{ field: "weekly", code: "X" }], [])).toEqual({});
  });
});

describe("overrideErrors", () => {
  it("puts date and interval errors on their fields", () => {
    expect(
      overrideErrors([
        { field: "date", code: "DATE_IN_PAST" },
        { field: "intervals[0]", code: "OPEN_NOT_BEFORE_CLOSE" },
      ]),
    ).toEqual({
      date: "Ngày này đã qua. Chọn hôm nay hoặc một ngày sau.",
      time: "Giờ mở phải trước giờ đóng (đóng muộn nhất 23:59).",
    });
    expect(overrideErrors([{ field: "intervals", code: "OPEN_WITHOUT_INTERVALS" }])).toEqual({
      time: "Nhập giờ mở và giờ đóng, hoặc chọn Đóng cả ngày.",
    });
  });
});
