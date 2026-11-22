import { describe, expect, it } from "vitest";
import { safeNext } from "./session";

describe("safeNext — only a path on this site (FE #70 review)", () => {
  it.each([
    ["/b/Q1-LELOI/menu?x=1#top", "/b/Q1-LELOI/menu?x=1#top"],
    ["/account", "/account"],
    [undefined, "/account"],
    ["https://evil.test/x", "/account"],
    ["//evil.test/x", "/account"],
    ["/\t/evil.test", "/account"],
    ["/\n/evil.test", "/account"],
    ["/\r/evil.test", "/account"],
    ["/\\evil.test", "/account"],
    ["\\\\evil.test", "/account"],
    ["javascript:alert(1)", "/account"],
  ])("%j → %s", (next, expected) => {
    expect(safeNext(next)).toBe(expected);
  });
});
