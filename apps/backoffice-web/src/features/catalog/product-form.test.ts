import { ApiError } from "@hayi/api-client";
import { describe, expect, it } from "vitest";
import {
  type ProductDraft,
  VARIANT_MAX,
  addVariant,
  createBody,
  emptyDraft,
  localErrors,
  parsePrice,
  removeVariant,
  serverErrors,
} from "./product-form";

function aDraft(overrides: Partial<ProductDraft> = {}): ProductDraft {
  return {
    name: "Matcha Latte",
    productCode: "matcha-latte",
    slug: "matcha-latte",
    primaryCategoryId: "c-tea",
    shortDescription: "",
    variants: [
      { key: "v1", sku: "matcha-latte-m", name: "M", price: "45.000 ₫" },
      { key: "v2", sku: "MATCHA-LATTE-L", name: "L", price: "55000" },
    ],
    defaultKey: "v1",
    ...overrides,
  };
}

function problem(code: string, status: number, errors?: { field: string; message?: string }[]) {
  return new ApiError({
    type: "about:blank",
    title: code,
    status,
    code,
    ...(errors && { errors: errors.map((e) => ({ code, ...e })) }),
  });
}

describe("parsePrice", () => {
  it.each([
    ["45.000 ₫", 45000],
    ["45000", 45000],
    [" 1 250 000 ", 1250000],
    ["0", 0],
  ])("%s → %d", (text, amount) => {
    expect(parsePrice(text)).toBe(amount);
  });

  it.each(["", "abc", "-5000", "45.000,5đ x"])("rejects %j", (text) => {
    expect(parsePrice(text)).toBeNull();
  });
});

describe("emptyDraft / addVariant / removeVariant", () => {
  it("starts with one default size", () => {
    const draft = emptyDraft(() => "k1");
    expect(draft.variants).toEqual([{ key: "k1", sku: "", name: "", price: "" }]);
    expect(draft.defaultKey).toBe("k1");
  });

  it("adds sizes up to the limit", () => {
    let draft = emptyDraft(() => "k0");
    for (let i = 1; i < VARIANT_MAX + 3; i++) draft = addVariant(draft, `k${i}`);
    expect(draft.variants).toHaveLength(VARIANT_MAX);
  });

  it("keeps one size and moves the default when the default is removed", () => {
    const draft = aDraft();
    const removed = removeVariant(draft, "v1");
    expect(removed.variants.map((v) => v.key)).toEqual(["v2"]);
    expect(removed.defaultKey).toBe("v2");
    expect(removeVariant(removed, "v2")).toBe(removed);
  });
});

describe("localErrors", () => {
  it("accepts a valid draft", () => {
    expect(localErrors(aDraft())).toEqual({});
  });

  it("checks name, code, slug and every size like the server does", () => {
    const errors = localErrors(
      aDraft({
        name: " ",
        productCode: "-BAD",
        slug: "Matcha Latte",
        variants: [
          { key: "v1", sku: "", name: "", price: "" },
          { key: "v2", sku: "X-1", name: "L", price: "abc" },
          { key: "v3", sku: "x-1", name: "XL", price: "60.000" },
        ],
      }),
    );
    expect(errors).toEqual({
      name: "Nhập tên món.",
      productCode: "Chỉ dùng chữ, số và dấu gạch ngang, bắt đầu bằng chữ hoặc số, tối đa 64 ký tự.",
      slug: "Chỉ dùng chữ thường không dấu, số và dấu gạch ngang, ví dụ matcha-latte.",
      "variants[0].sku": "Nhập mã SKU.",
      "variants[0].name": "Nhập tên size.",
      "variants[0].basePrice": "Nhập giá gốc, ví dụ 45.000.",
      "variants[1].basePrice": "Nhập giá gốc, ví dụ 45.000.",
      "variants[2].sku": "Mã SKU trùng với size 2.",
    });
  });
});

describe("createBody", () => {
  it("upper-cases codes, parses prices and marks the one default", () => {
    expect(createBody(aDraft())).toEqual({
      productCode: "MATCHA-LATTE",
      name: "Matcha Latte",
      slug: "matcha-latte",
      primaryCategoryId: "c-tea",
      variants: [
        { sku: "MATCHA-LATTE-M", name: "M", basePrice: 45000, isDefault: true },
        { sku: "MATCHA-LATTE-L", name: "L", basePrice: 55000, isDefault: false },
      ],
    });
  });

  it("leaves out an empty category and short description", () => {
    const body = createBody(aDraft({ primaryCategoryId: "", shortDescription: "  Mát lạnh " }));
    expect(body).not.toHaveProperty("primaryCategoryId");
    expect(body.shortDescription).toBe("Mát lạnh");
  });
});

describe("serverErrors", () => {
  it("puts taken codes and slugs on their field", () => {
    expect(serverErrors(problem("CATALOG_CODE_TAKEN", 409), aDraft())).toEqual({
      productCode: "Mã món này đã được dùng, kể cả bởi món đã lưu trữ. Đặt mã khác.",
    });
    expect(serverErrors(problem("CATALOG_SLUG_TAKEN", 409), aDraft())).toEqual({
      slug: "Đường dẫn này đã được dùng cho món khác. Đặt đường dẫn khác.",
    });
    expect(serverErrors(problem("CATALOG_CATEGORY_ARCHIVED", 409), aDraft())).toEqual({
      primaryCategoryId: "Danh mục này vừa được lưu trữ. Chọn danh mục khác.",
    });
  });

  it("puts a taken SKU on the field the server names, else on the only size, else on the sizes", () => {
    const taken = "Mã SKU này đã được dùng, kể cả bởi món đã lưu trữ. Đặt mã khác.";
    expect(serverErrors(problem("CATALOG_SKU_TAKEN", 409, [{ field: "variants[1].sku" }]), aDraft())).toEqual({
      "variants[1].sku": taken,
    });
    const single = aDraft({ variants: [{ key: "v1", sku: "A", name: "Standard", price: "1" }] });
    expect(serverErrors(problem("CATALOG_SKU_TAKEN", 409), single)).toEqual({ "variants[0].sku": taken });
    expect(serverErrors(problem("CATALOG_SKU_TAKEN", 409), aDraft())).toEqual({
      variants: "Một mã SKU đã được dùng, kể cả bởi món đã lưu trữ. Kiểm tra lại các mã SKU.",
    });
  });

  it("maps validation errors by field and ignores unknown fields", () => {
    const error = problem("VALIDATION_FAILED", 400, [
      { field: "name", message: "Tên quá dài" },
      { field: "variants[0].basePrice", message: "Giá không hợp lệ" },
      { field: "somethingElse", message: "?" },
    ]);
    expect(serverErrors(error, aDraft())).toEqual({ name: "Tên quá dài", "variants[0].basePrice": "Giá không hợp lệ" });
    expect(serverErrors(problem("CATALOG_PRICE_NEGATIVE", 422, [{ field: "variants[1].basePrice" }]), aDraft())).toEqual({
      "variants[1].basePrice": "Giá gốc không được âm.",
    });
  });

  it("returns nothing for other errors", () => {
    expect(serverErrors(problem("INTERNAL_ERROR", 500), aDraft())).toEqual({});
    expect(serverErrors(new Error("network"), aDraft())).toEqual({});
  });
});
