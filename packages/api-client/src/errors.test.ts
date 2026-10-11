import { describe, expect, it } from "vitest";
import { ApiError, toProblem } from "./errors.js";

describe("toProblem", () => {
  it("keeps the stable business code from Problem Details", () => {
    const p = toProblem(422, { code: "SLOT_FULL", title: "Slot đã đầy", status: 422 });
    expect(new ApiError(p).code).toBe("SLOT_FULL");
  });

  it("falls back when the body is not Problem Details", () => {
    expect(toProblem(502, "<html>").code).toBe("SERVICE_UNAVAILABLE");
  });
});
