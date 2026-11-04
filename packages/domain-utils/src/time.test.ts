import { describe, expect, it } from "vitest";
import { branchDaysFromToday, formatBranchDate, formatBranchDayMonth, formatIsoDate, todayInBranch } from "./time.js";

describe("branchDaysFromToday — calendar days in the Branch's timezone", () => {
  // 01:30 on 5 Nov in Ho Chi Minh City (still 4 Nov in UTC).
  const now = new Date("2026-11-04T18:30:00Z");

  it("is 0 for later today, 1 for tomorrow, 2 for the day after", () => {
    expect(branchDaysFromToday("2026-11-05T08:00:00Z", now)).toBe(0);
    expect(branchDaysFromToday("2026-11-05T17:30:00Z", now)).toBe(1); // 00:30 on 6 Nov local
    expect(branchDaysFromToday("2026-11-07T01:00:00Z", now)).toBe(2);
  });

  it("counts local dates, not 24-hour periods", () => {
    // 23:59 on 5 Nov local is still today, though 22 hours away.
    expect(branchDaysFromToday("2026-11-05T16:59:00Z", now)).toBe(0);
  });
});

describe("formatBranchDayMonth", () => {
  it("formats an instant as dd/MM in the Branch's timezone", () => {
    expect(formatBranchDayMonth("2026-11-05T17:30:00Z")).toBe("06/11");
  });
});

describe("formatBranchDate", () => {
  it("formats a UTC instant as dd/MM/yyyy in Asia/Ho_Chi_Minh", () => {
    expect(formatBranchDate("2026-09-02T03:00:00Z")).toBe("02/09/2026");
  });

  it("uses the Branch's local date, not the UTC one", () => {
    // 18:30 UTC on 1 Sep is 01:30 on 2 Sep in Ho Chi Minh City.
    expect(formatBranchDate("2026-09-01T18:30:00Z")).toBe("02/09/2026");
  });
});

describe("formatIsoDate", () => {
  it("formats a calendar date as dd/MM/yyyy whatever the device timezone", () => {
    expect(formatIsoDate("2026-12-24")).toBe("24/12/2026");
    expect(formatIsoDate("2027-01-01")).toBe("01/01/2027");
  });
});

describe("todayInBranch", () => {
  it("is the Branch's calendar date (yyyy-MM-dd), not the UTC one", () => {
    // 18:30 UTC on 1 Sep is 01:30 on 2 Sep in Ho Chi Minh City.
    expect(todayInBranch(new Date("2026-09-01T18:30:00Z"))).toBe("2026-09-02");
    expect(todayInBranch(new Date("2026-09-01T03:00:00Z"))).toBe("2026-09-01");
  });
});
