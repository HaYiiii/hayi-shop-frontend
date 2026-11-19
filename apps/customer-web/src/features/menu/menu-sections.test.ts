import { describe, expect, it } from "vitest";
import { menuJumps, menuSections } from "./menu-sections";
import { aMenu } from "./test/menu";

describe("menuSections", () => {
  it("lists each root Category, then its children, in the API's order", () => {
    const sections = menuSections(aMenu());
    expect(sections.map((s) => [s.name, s.anchor, s.level, s.products.length])).toEqual([
      ["Matcha", "c-matcha", 1, 0],
      ["Matcha latte", "c-matcha-latte", 2, 2],
      ["Matcha đá xay", "c-matcha-da-xay", 2, 1],
      ["Bánh", "c-banh", 1, 1],
    ]);
  });

  it("the category bar jumps to root Categories", () => {
    expect(menuJumps(aMenu())).toEqual([
      { name: "Matcha", anchor: "c-matcha" },
      { name: "Bánh", anchor: "c-banh" },
    ]);
  });
});
