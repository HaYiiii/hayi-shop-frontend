import { describe, expect, it } from "vitest";
import { formatBranchDate } from "./time.js";

describe("formatBranchDate", () => {
  it("formats a UTC instant as dd/MM/yyyy in Asia/Ho_Chi_Minh", () => {
    expect(formatBranchDate("2026-09-02T03:00:00Z")).toBe("02/09/2026");
  });

  it("uses the Branch's local date, not the UTC one", () => {
    // 18:30 UTC on 1 Sep is 01:30 on 2 Sep in Ho Chi Minh City.
    expect(formatBranchDate("2026-09-01T18:30:00Z")).toBe("02/09/2026");
  });
});
