import { createPublicClient } from "@hayi/api-client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadBranches } from "./branches";

const branch = {
  branchId: "0192-q1",
  branchCode: "Q1-LELOI",
  name: "Quận 1 · Lê Lợi",
  address: { line: "68 Lê Lợi", ward: "Bến Nghé", district: "Quận 1", province: "TP.HCM" },
  location: null,
  phone: null,
  timezone: "Asia/Ho_Chi_Minh",
  openNow: true,
  todayHours: [{ open: "07:00", close: "22:00" }],
  fulfillmentTypes: ["PICKUP"],
  earliestPickupAt: "2026-11-05T08:00:00Z",
};

function serve(answer: () => Response | Promise<Response>) {
  const fetch = vi.fn((request: Request) => {
    expect(new URL(request.url).pathname).toBe("/api/public/v1/branches");
    return answer();
  });
  vi.stubGlobal("fetch", fetch);
  return createPublicClient({ baseUrl: "http://api.test" });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("loadBranches — GET /api/public/v1/branches (API 02 §1)", () => {
  it("returns the ACTIVE Branches", async () => {
    const api = serve(() => Response.json({ items: [branch] }));

    expect(await loadBranches(api)).toEqual({ ok: true, branches: [branch] });
  });

  it("returns the Problem code of a refused request", async () => {
    const api = serve(() =>
      Response.json({ status: 429, code: "RATE_LIMITED" }, { status: 429, headers: { "Content-Type": "application/problem+json" } }),
    );

    expect(await loadBranches(api)).toEqual({ ok: false, code: "RATE_LIMITED" });
  });

  it("calls a failed connection NETWORK_ERROR", async () => {
    const api = serve(() => Promise.reject(new TypeError("fetch failed")));

    expect(await loadBranches(api)).toEqual({ ok: false, code: "NETWORK_ERROR" });
  });
});
