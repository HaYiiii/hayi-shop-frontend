import { describe, expect, it } from "vitest";
import { formatVnd } from "./money.js";
import { formatBranchTime } from "./time.js";

describe("formatVnd", () => {
  it("formats integer VND with vi-VN grouping", () => {
    expect(formatVnd(117000).replace(/\s/g, " ")).toBe("117.000 ₫");
  });

  it("rejects non-integer amounts", () => {
    expect(() => formatVnd(1.5)).toThrow(RangeError);
  });
});

describe("formatBranchTime", () => {
  it("converts UTC instant to Asia/Ho_Chi_Minh local time", () => {
    expect(formatBranchTime("2026-10-12T02:30:00Z")).toBe("09:30");
  });
});
