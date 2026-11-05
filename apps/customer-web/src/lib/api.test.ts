import { afterEach, describe, expect, it, vi } from "vitest";
import { loadBranches } from "../features/branch/api/branches";
import { PUBLIC_REVALIDATE_SECONDS, publicApi } from "./api";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("publicApi — server-side reads of the public API (Decision X1)", () => {
  it("caches GET /branches in Next.js for a minute instead of calling the API on every render (W9: 120 req/min per IP)", async () => {
    const fetch = vi.fn((_request: Request, _init?: unknown) => Promise.resolve(Response.json({ items: [] })));
    vi.stubGlobal("fetch", fetch);

    await loadBranches(publicApi());

    const [request, init] = fetch.mock.calls[0] ?? [];
    expect(PUBLIC_REVALIDATE_SECONDS).toBe(60);
    expect(init).toEqual({ next: { revalidate: 60 } });
    expect(request?.cache).not.toBe("no-store");
  });
});
