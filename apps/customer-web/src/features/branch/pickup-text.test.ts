import { describe, expect, it } from "vitest";
import { pickupText } from "./pickup-text";

// 10:00 on 5 Nov in Ho Chi Minh City.
const now = new Date("2026-11-05T03:00:00Z");

describe("pickupText — earliestPickupAt as the customer reads it (Decision N5, D3a screen 1)", () => {
  it("gives the time for a slot later today, in Vietnam time", () => {
    expect(pickupText("2026-11-05T08:00:00Z", now)).toEqual({ text: "Lấy sớm nhất 15:00 hôm nay", today: true });
  });

  it("offers tomorrow when today is full", () => {
    // 00:30 on 6 Nov local, though still 5 Nov in UTC.
    expect(pickupText("2026-11-05T17:30:00Z", now)).toEqual({
      text: "Hôm nay hết nhận đơn · đặt trước cho ngày mai",
      today: false,
    });
  });

  it("names the first day with a slot when that is later", () => {
    expect(pickupText("2026-11-08T01:00:00Z", now)).toEqual({
      text: "Hôm nay hết nhận đơn · đặt trước từ 08/11",
      today: false,
    });
  });

  it("says nothing can be booked when there is no slot in the next 7 days", () => {
    expect(pickupText(null, now)).toEqual({ text: "Hôm nay hết nhận đơn · chưa nhận đặt trước", today: false });
  });
});
