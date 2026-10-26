import { afterEach, describe, expect, it, vi } from "vitest";
import { createSessionFetch } from "./session-fetch.js";

const API = "https://api.test/api/backoffice/v1";

function problem(status: number, code: string) {
  return new Response(JSON.stringify({ status, code, title: code }), {
    status,
    headers: { "Content-Type": "application/problem+json" },
  });
}

function ok(body: unknown = { ok: true }) {
  return Response.json(body);
}

/** Fake API: the access cookie is "expired" until /auth/refresh succeeds. */
function fakeApi({ refreshSucceeds = true } = {}) {
  let refreshed = false;
  const calls: { method: string; path: string; csrf: string | null; idempotencyKey: string | null; body: string }[] = [];
  const fetch = vi.fn(async (request: Request) => {
    const path = new URL(request.url).pathname.replace("/api/backoffice/v1", "");
    calls.push({
      method: request.method,
      path,
      csrf: request.headers.get("X-CSRF-Token"),
      idempotencyKey: request.headers.get("Idempotency-Key"),
      body: await request.text(),
    });
    if (path === "/auth/refresh") {
      if (!refreshSucceeds) return problem(401, "AUTH_REQUIRED");
      refreshed = true;
      return new Response(null, { status: 204 });
    }
    if (path === "/auth/login") return problem(401, "AUTH_INVALID_CREDENTIALS");
    return refreshed ? ok() : problem(401, "AUTH_TOKEN_EXPIRED");
  });
  return { fetch, calls };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createSessionFetch — 401 → refresh → retry (API 01-security §5)", () => {
  it("refreshes once and replays the request with its body", async () => {
    const api = fakeApi();
    const sessionFetch = createSessionFetch({ fetch: api.fetch, refreshUrl: `${API}/auth/refresh` });

    const res = await sessionFetch(new Request(`${API}/orders`, { method: "POST", body: '{"a":1}' }));

    expect(res.status).toBe(200);
    expect(api.calls.map((c) => c.path)).toEqual(["/orders", "/auth/refresh", "/orders"]);
    expect(api.calls[2]?.body).toBe('{"a":1}');
  });

  it("refreshes when the access cookie is gone (AUTH_REQUIRED)", async () => {
    let refreshed = false;
    const fetch = vi.fn(async (request: Request) => {
      if (request.url.endsWith("/auth/refresh")) {
        refreshed = true;
        return new Response(null, { status: 204 });
      }
      return refreshed ? ok() : problem(401, "AUTH_REQUIRED");
    });
    const sessionFetch = createSessionFetch({ fetch, refreshUrl: `${API}/auth/refresh` });

    expect((await sessionFetch(new Request(`${API}/auth/me`))).status).toBe(200);
  });

  it("shares one refresh between concurrent 401s", async () => {
    const api = fakeApi();
    const sessionFetch = createSessionFetch({ fetch: api.fetch, refreshUrl: `${API}/auth/refresh` });

    const results = await Promise.all(
      ["/a", "/b", "/c"].map((p) => sessionFetch(new Request(`${API}${p}`))),
    );

    expect(results.map((r) => r.status)).toEqual([200, 200, 200]);
    expect(api.calls.filter((c) => c.path === "/auth/refresh")).toHaveLength(1);
  });

  it("re-reads the CSRF cookie for the refresh and the replay (rotated with the session)", async () => {
    const jar = { cookie: "hy_csrf=old" };
    vi.stubGlobal("document", jar);
    const api = fakeApi();
    const fetch = vi.fn(async (request: Request) => {
      const res = await api.fetch(request);
      if (request.url.endsWith("/auth/refresh")) jar.cookie = "hy_csrf=new";
      return res;
    });
    const sessionFetch = createSessionFetch({ fetch, refreshUrl: `${API}/auth/refresh` });

    await sessionFetch(new Request(`${API}/orders`, { method: "POST", headers: { "X-CSRF-Token": "old" } }));

    expect(api.calls.map((c) => c.csrf)).toEqual(["old", "old", "new"]);
  });

  it("reports the session as expired when the refresh fails, and returns the original 401", async () => {
    const api = fakeApi({ refreshSucceeds: false });
    const onSessionExpired = vi.fn();
    const sessionFetch = createSessionFetch({ fetch: api.fetch, refreshUrl: `${API}/auth/refresh`, onSessionExpired });

    const res = await sessionFetch(new Request(`${API}/orders`));

    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ code: "AUTH_TOKEN_EXPIRED" });
    expect(onSessionExpired).toHaveBeenCalledOnce();
  });

  it("does not refresh for the sign-in endpoints themselves", async () => {
    const api = fakeApi();
    const sessionFetch = createSessionFetch({ fetch: api.fetch, refreshUrl: `${API}/auth/refresh` });

    const res = await sessionFetch(new Request(`${API}/auth/login`, { method: "POST", body: "{}" }));

    expect(res.status).toBe(401);
    expect(api.calls.map((c) => c.path)).toEqual(["/auth/login"]);
  });

  it("does not refresh for other 401 codes", async () => {
    const fetch = vi.fn(async () => problem(401, "AUTH_SESSION_REVOKED"));
    const sessionFetch = createSessionFetch({ fetch, refreshUrl: `${API}/auth/refresh` });

    await sessionFetch(new Request(`${API}/orders`));

    expect(fetch).toHaveBeenCalledOnce();
  });
});

describe("createSessionFetch — 403 STEP_UP_REQUIRED (API 01-security §8)", () => {
  function stepUpApi() {
    let verified = false;
    const calls: Request[] = [];
    const fetch = vi.fn(async (request: Request) => {
      calls.push(request.clone());
      return verified ? ok() : problem(403, "STEP_UP_REQUIRED");
    });
    return { fetch, calls, verify: () => (verified = true) };
  }

  it("asks for step-up, then replays the request with the same Idempotency-Key", async () => {
    const api = stepUpApi();
    const onStepUpRequired = vi.fn(async () => {
      api.verify();
    });
    const sessionFetch = createSessionFetch({ fetch: api.fetch, refreshUrl: `${API}/auth/refresh`, onStepUpRequired });

    const res = await sessionFetch(
      new Request(`${API}/refunds/1/approve`, { method: "POST", headers: { "Idempotency-Key": "k-1" } }),
    );

    expect(res.status).toBe(200);
    expect(onStepUpRequired).toHaveBeenCalledOnce();
    expect(api.calls.map((r) => r.headers.get("Idempotency-Key"))).toEqual(["k-1", "k-1"]);
  });

  it("returns the 403 when the user cancels the step-up", async () => {
    const api = stepUpApi();
    const sessionFetch = createSessionFetch({
      fetch: api.fetch,
      refreshUrl: `${API}/auth/refresh`,
      onStepUpRequired: () => Promise.reject(new Error("cancelled")),
    });

    const res = await sessionFetch(new Request(`${API}/refunds/1/approve`, { method: "POST" }));

    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: "STEP_UP_REQUIRED" });
    expect(api.fetch).toHaveBeenCalledOnce();
  });
});
