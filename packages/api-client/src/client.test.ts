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

describe("createCustomerClient — session (API 01-security §5, FE #70)", () => {
  it("refreshes an expired access token once on the Customer surface and replays", async () => {
    vi.stubGlobal("document", { cookie: "hy_c_csrf=c1" });
    let refreshed = false;
    const paths: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((request: Request) => {
        const path = new URL(request.url).pathname;
        paths.push(`${request.method} ${path} ${request.headers.get("X-CSRF-Token") ?? "-"}`);
        if (path.endsWith("/auth/refresh")) {
          refreshed = true;
          return Promise.resolve(new Response(null, { status: 204 }));
        }
        return Promise.resolve(
          refreshed ? Response.json({ customerId: "c" }) : Response.json({ status: 401, code: "AUTH_TOKEN_EXPIRED" }, { status: 401 }),
        );
      }),
    );
    const api = createCustomerClient({ baseUrl: "http://web.test" });

    const { response } = await api.GET("/auth/me");

    expect(response.status).toBe(200);
    expect(paths).toEqual(["GET /api/customer/v1/auth/me -", "POST /api/customer/v1/auth/refresh c1", "GET /api/customer/v1/auth/me -"]);
  });

  it("reports the end of the session when the refresh is refused", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(Response.json({ status: 401, code: "AUTH_REQUIRED" }, { status: 401 }))),
    );
    const onSessionExpired = vi.fn();
    const api = createCustomerClient({ baseUrl: "http://web.test", onSessionExpired });

    const { response } = await api.GET("/auth/me");

    expect(response.status).toBe(401);
    expect(onSessionExpired).toHaveBeenCalledOnce();
  });
});
