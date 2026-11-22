import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

describe("same-origin API proxy (Decision AU1, API 01-security §2)", () => {
  it("forwards the Customer surface and the public API, and nothing else", async () => {
    const rewrites = await nextConfig.rewrites?.();
    expect(rewrites).toEqual([
      { source: "/api/customer/:path*", destination: "http://localhost:8080/api/customer/:path*" },
      { source: "/api/public/:path*", destination: "http://localhost:8080/api/public/:path*" },
    ]);
  });
});
