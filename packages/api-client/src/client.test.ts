import { afterEach, describe, expect, it, vi } from "vitest";
import { createBackofficeClient, createCustomerClient, createPublicClient } from "./client.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createPublicClient", () => {
  it("passes requestInitExt as fetch's second argument, where Next.js reads `next.revalidate`", async () => {
    const fetch = vi.fn((_request: Request, _init?: unknown) => Promise.resolve(Response.json({ items: [] })));
    vi.stubGlobal("fetch", fetch);
    const api = createPublicClient({ baseUrl: "http://api.test", requestInitExt: { next: { revalidate: 60 } } });

    await api.GET("/branches");

    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch.mock.calls[0]?.[1]).toEqual({ next: { revalidate: 60 } });
  });
});

describe("CSRF cookie per surface (API 01-security §3.1, Decision AP1)", () => {
  /** Both surfaces' cookies are set, as when Backoffice and Customer Web run in one browser. */
  function setUp() {
    vi.stubGlobal("document", { cookie: "hy_c_csrf=customer-token; hy_b_csrf=staff-token" });
    const fetch = vi.fn((_request: Request) => Promise.resolve(Response.json({})));
    vi.stubGlobal("fetch", fetch);
    return () => fetch.mock.calls[0]![0].headers.get("X-CSRF-Token");
  }

  it("Backoffice sends the hy_b_csrf value and ignores the Customer cookie", async () => {
    const csrfOf = setUp();
    const api = createBackofficeClient({ baseUrl: "http://api.test" });
    await api.POST("/auth/logout");
    expect(csrfOf()).toBe("staff-token");
  });

  it("Customer sends the hy_c_csrf value and ignores the Backoffice cookie", async () => {
    const csrfOf = setUp();
    const api = createCustomerClient({ baseUrl: "http://api.test" });
    await api.POST("/auth/logout");
    expect(csrfOf()).toBe("customer-token");
  });

  it("sends no header for safe methods", async () => {
    const csrfOf = setUp();
    await createBackofficeClient({ baseUrl: "http://api.test" }).GET("/auth/me");
    expect(csrfOf()).toBeNull();
  });
});
