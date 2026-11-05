import { afterEach, describe, expect, it, vi } from "vitest";
import { createPublicClient } from "./client.js";

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
