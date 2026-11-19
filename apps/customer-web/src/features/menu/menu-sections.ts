import { formatBranchTime } from "@hayi/domain-utils";
import type { MenuAvailability, MenuCategory, MenuProduct, PublicMenu } from "./api/menu";

/** One heading of the menu page: a root Category, or a child Category under it. */
export interface MenuSection {
  categoryId: string;
  name: string;
  /** Anchor of the section, for the category bar (`#c-matcha`). */
  anchor: string;
  /** `1` = root Category, `2` = child Category. */
  level: 1 | 2;
  products: MenuProduct[];
}

/** The category bar jumps to root Categories only (D3a screen 2); a child section follows its root. */
export interface MenuJump {
  name: string;
  anchor: string;
}

const anchorOf = (category: MenuCategory) => `c-${category.slug}`;

/**
 * The menu as sections in the API's order (Decision AH1): each root Category, then its children.
 * A Category without products of its own shows only through its children.
 */
export function menuSections(menu: PublicMenu): MenuSection[] {
  return menu.categories.flatMap((root) => [
    { categoryId: root.categoryId, name: root.name, anchor: anchorOf(root), level: 1 as const, products: root.products },
    ...root.children.map((child) => ({
      categoryId: child.categoryId,
      name: child.name,
      anchor: anchorOf(child),
      level: 2 as const,
      products: child.products,
    })),
  ]);
}

export function menuJumps(menu: PublicMenu): MenuJump[] {
  return menu.categories.map((root) => ({ name: root.name, anchor: anchorOf(root) }));
}

/**
 * Words for a product that cannot be ordered at the menu's `evaluatedAt` (API 02 §2, AK3); `null` when it can.
 * Outside its selling schedule it names that time in Branch time (D3a screen 2b, agreed 2026-11-20: the time
 * the menu was evaluated at, until the customer picks a pickup time in S4).
 */
export function availabilityText(availability: MenuAvailability, evaluatedAt: string): string | null {
  switch (availability) {
    case "AVAILABLE":
      return null;
    case "SOLD_OUT":
      return "Hết món";
    case "PAUSED":
      return "Tạm ngưng";
    case "OUTSIDE_SELLING_HOURS":
      return `Không bán lúc ${formatBranchTime(evaluatedAt)}`;
  }
}
