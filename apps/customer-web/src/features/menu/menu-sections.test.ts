import { describe, expect, it } from "vitest";
import { menuCollections, menuJumps, menuSections } from "./menu-sections";
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

describe("menuCollections (D3a screen 2b)", () => {
  it("resolves each Collection's productIds to the menu's products, in Collection order", () => {
    const menu = aMenu({
      collections: [
        { collectionId: "col-thu", name: "Mùa thu", productIds: ["p-ice", "p-latte", "p-gone"] },
        { collectionId: "col-empty", name: "Trống", productIds: ["p-gone"] },
      ],
    });
    expect(menuCollections(menu).map((c) => [c.name, c.anchor, c.products.map((p) => p.productId)])).toEqual([
      ["Mùa thu", "bst-col-thu", ["p-ice", "p-latte"]],
    ]);
  });
});
