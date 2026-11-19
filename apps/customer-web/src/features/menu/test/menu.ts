import type { MenuCategory, MenuProduct, PublicMenu } from "../api/menu";

export function aMenuProduct(overrides: Partial<MenuProduct> = {}): MenuProduct {
  return {
    productId: "p-latte",
    slug: "matcha-latte",
    name: "Matcha latte đá",
    primaryImageUrl: "https://cdn.hayi.test/p/latte.webp",
    fromPrice: 45000,
    availability: "AVAILABLE",
    tags: [],
    ...overrides,
  };
}

const category = (categoryId: string, name: string, slug: string, products: MenuProduct[], children: MenuCategory[] = []): MenuCategory => ({
  categoryId,
  name,
  slug,
  imageUrl: null,
  products,
  children,
});

/** Matcha (root, no own products) › Matcha latte (2) and Matcha đá xay (1, sold out); Bánh (1, paused, no image). */
export function aMenu(overrides: Partial<PublicMenu> = {}): PublicMenu {
  return {
    branchId: "b-q1",
    evaluatedAt: "2026-11-19T03:00:00Z",
    categories: [
      category("c-matcha", "Matcha", "matcha", [], [
        category("c-latte", "Matcha latte", "matcha-latte", [
          aMenuProduct(),
          aMenuProduct({ productId: "p-hot", slug: "matcha-latte-nong", name: "Matcha latte nóng", fromPrice: 55000 }),
        ]),
        category("c-ice", "Matcha đá xay", "matcha-da-xay", [
          aMenuProduct({ productId: "p-ice", slug: "matcha-da-xay", name: "Matcha đá xay", fromPrice: 59000, availability: "SOLD_OUT" }),
        ]),
      ]),
      category("c-cake", "Bánh", "banh", [
        aMenuProduct({ productId: "p-cake", slug: "banh-matcha", name: "Bánh bông lan matcha", fromPrice: 39000, availability: "PAUSED", primaryImageUrl: null }),
      ]),
    ],
    collections: [],
    ...overrides,
  };
}
