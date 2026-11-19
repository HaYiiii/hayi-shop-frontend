import type { DetailOptionGroup, DetailOptionItem, ProductDetail } from "../option-selection";

export const item = (optionItemId: string, name: string, extraPrice = 0, overrides: Partial<DetailOptionItem> = {}): DetailOptionItem => ({
  optionItemId,
  name,
  extraPrice,
  isDefaultSelected: false,
  availability: "AVAILABLE",
  ...overrides,
});

export const group = (optionGroupId: string, name: string, overrides: Partial<DetailOptionGroup> = {}): DetailOptionGroup => ({
  optionGroupId,
  name,
  selectionType: "SINGLE",
  minSelect: 1,
  maxSelect: 1,
  items: [],
  ...overrides,
});

/**
 * Matcha latte nóng: M 55.000 (default), L 65.000 sold out; Loại sữa (required, default Sữa tươi, Yến mạch sold
 * out); Độ ngọt (optional single); Thêm (multiple, max 2).
 */
export function aProductDetail(overrides: Partial<ProductDetail> = {}): ProductDetail {
  return {
    productId: "p-hot",
    slug: "matcha-latte-nong",
    name: "Matcha latte nóng",
    description: "Ấm, thơm cỏ non, hậu ngọt nhẹ.",
    images: [{ url: "https://cdn.hayi.test/p/hot.webp", altText: "Matcha latte nóng trong ly gốm", isPrimary: true }],
    availability: "AVAILABLE",
    variants: [
      { variantId: "v-m", name: "M", price: 55000, isDefault: true, availability: "AVAILABLE" },
      { variantId: "v-l", name: "L", price: 65000, isDefault: false, availability: "SOLD_OUT" },
    ],
    optionGroups: [
      group("g-milk", "Loại sữa", {
        items: [item("i-fresh", "Sữa tươi", 0, { isDefaultSelected: true }), item("i-oat", "Sữa yến mạch", 10000, { availability: "SOLD_OUT" })],
      }),
      group("g-sweet", "Độ ngọt", { minSelect: 0, items: [item("i-100", "100%"), item("i-70", "70%"), item("i-0", "Không đường")] }),
      group("g-extra", "Thêm", {
        selectionType: "MULTIPLE",
        minSelect: 0,
        maxSelect: 2,
        items: [item("i-shot", "Thêm 1 shot matcha", 10000), item("i-cream", "Kem muối", 8000), item("i-pearl", "Trân châu", 6000)],
      }),
    ],
    sellingSchedule: null,
    ...overrides,
  };
}
