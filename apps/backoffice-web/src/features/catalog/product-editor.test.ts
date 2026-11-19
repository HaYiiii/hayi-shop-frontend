import { ApiError } from "@hayi/api-client";
import { formatVnd } from "@hayi/domain-utils";
import { describe, expect, it } from "vitest";
import {
  activationIssues,
  addSize,
  editorOf,
  isEdited,
  localErrors,
  rebase,
  removeNewSize,
  sameContent,
  savePlan,
  serverErrors,
  setSize,
} from "./product-editor";
import { aProduct } from "./test/products";

let n = 0;
const newKey = () => `new-${++n}`;

describe("editorOf", () => {
  it("holds the editable fields and the sizes that are not archived, in their order", () => {
    const product = aProduct({
      shortDescription: "Mát lạnh",
      variants: [
        ...aProduct().variants,
        { variantId: "v-s", sku: "MATCHA-DX-S", name: "S", basePrice: 45000, isDefault: false, status: "ARCHIVED", sortOrder: 2 },
      ],
    });
    const editor = editorOf(product);
    expect(editor).toMatchObject({
      name: "Matcha Đá Xay",
      slug: "matcha-da-xay",
      primaryCategoryId: "c-tea",
      shortDescription: "Mát lạnh",
      description: "",
      defaultKey: "v-l",
    });
    expect(editor.sizes.map((s) => [s.key, s.sku, s.name, s.price])).toEqual([
      ["v-m", "MATCHA-DX-M", "M", formatVnd(55000)],
      ["v-l", "MATCHA-DX-L", "L", formatVnd(65000)],
    ]);
    expect(isEdited(editor, product)).toBe(false);
  });
});

describe("savePlan", () => {
  const product = aProduct();

  it("has nothing to send for an unchanged editor", () => {
    expect(savePlan(product, editorOf(product))).toEqual([]);
  });

  it("patches only the changed Product fields, clearing empty optional ones with null", () => {
    const editor = { ...editorOf(aProduct({ shortDescription: "Cũ" })), name: " Matcha Kem ", shortDescription: "", primaryCategoryId: "" };
    expect(savePlan(aProduct({ shortDescription: "Cũ" }), editor)).toEqual([
      { kind: "product", body: { name: "Matcha Kem", primaryCategoryId: null, shortDescription: null } },
    ]);
  });

  it("then patches changed sizes (a new default with isDefault true), then adds new sizes", () => {
    let editor = editorOf(product);
    editor = setSize(editor, "v-m", { name: "Nhỏ", price: "50.000" });
    editor = { ...editor, defaultKey: "v-m" };
    editor = addSize(editor, "new-x");
    editor = setSize(editor, "new-x", { sku: "matcha-dx-xl", name: "XL", price: "75000" });
    expect(savePlan(product, editor)).toEqual([
      { kind: "size", index: 0, variantId: "v-m", body: { name: "Nhỏ", basePrice: 50000, isDefault: true } },
      { kind: "add", index: 2, body: { sku: "MATCHA-DX-XL", name: "XL", basePrice: 75000 } },
    ]);
  });

  it("adds a new size as the default when it was chosen", () => {
    let editor = addSize(editorOf(product), "new-y");
    editor = setSize(editor, "new-y", { sku: "X", name: "X", price: "1" });
    editor = { ...editor, defaultKey: "new-y" };
    expect(savePlan(product, editor)).toEqual([{ kind: "add", index: 2, body: { sku: "X", name: "X", basePrice: 1, isDefault: true } }]);
  });
});

describe("localErrors", () => {
  it("checks what the server checks, new SKUs against every size", () => {
    let editor = { ...editorOf(aProduct()), name: " ", slug: "Có Dấu" };
    editor = setSize(editor, "v-m", { name: "", price: "abc" });
    editor = addSize(editor, "a");
    editor = setSize(editor, "a", { sku: "matcha-dx-l", name: "XL", price: "1" });
    editor = addSize(editor, "b");
    expect(localErrors(editor)).toEqual({
      name: "Nhập tên món.",
      slug: "Chỉ dùng chữ thường không dấu, số và dấu gạch ngang, ví dụ matcha-latte.",
      "sizes[0].name": "Nhập tên size.",
      "sizes[0].basePrice": "Nhập giá gốc, ví dụ 45.000.",
      "sizes[2].sku": "Mã SKU trùng với size 2.",
      "sizes[3].sku": "Nhập mã SKU.",
      "sizes[3].name": "Nhập tên size.",
      "sizes[3].basePrice": "Nhập giá gốc, ví dụ 45.000.",
    });
  });
});

describe("addSize / removeNewSize", () => {
  it("adds up to 20 sizes and removes only unsaved ones; the default falls back to the first size", () => {
    let editor = addSize(editorOf(aProduct()), "z");
    editor = { ...editor, defaultKey: "z" };
    editor = removeNewSize(editor, "z");
    expect(editor.sizes.map((s) => s.key)).toEqual(["v-m", "v-l"]);
    expect(editor.defaultKey).toBe("v-m");
    expect(removeNewSize(editor, "v-m").sizes).toHaveLength(2);
    for (let i = 0; i < 30; i++) editor = addSize(editor, newKey());
    expect(editor.sizes).toHaveLength(20);
  });
});

describe("sameContent / rebase", () => {
  const before = aProduct({ version: 3 });

  it("a lifecycle change only moves status and version: same content", () => {
    expect(sameContent(before, { ...before, status: "ACTIVE", version: 4, updatedAt: "2026-11-19T00:00:00Z" })).toBe(true);
    expect(sameContent(before, { ...before, name: "Khác", version: 4 })).toBe(false);
  });

  it("takes new values where the user typed nothing, keeps typed ones, drops archived sizes, keeps new rows", () => {
    let editor = { ...editorOf(before), name: "Tên gõ" };
    editor = setSize(editor, "v-m", { price: "60.000" });
    editor = addSize(editor, "n1");
    const after = aProduct({
      version: 5,
      name: "Tên server",
      slug: "slug-moi",
      variants: [
        { ...before.variants[0]!, name: "Size M", basePrice: 57000 },
        { ...before.variants[1]!, status: "ARCHIVED", isDefault: false },
        { variantId: "v-xl", sku: "MATCHA-DX-XL", name: "XL", basePrice: 75000, isDefault: true, status: "ACTIVE", sortOrder: 2 },
      ],
    });
    const next = rebase(editor, before, after);
    expect(next.name).toBe("Tên gõ");
    expect(next.slug).toBe("slug-moi");
    expect(next.sizes.map((s) => [s.key, s.name, s.price])).toEqual([
      ["v-m", "Size M", "60.000"],
      ["v-xl", "XL", formatVnd(75000)],
      ["n1", "", ""],
    ]);
    expect(next.defaultKey).toBe("v-xl");
  });
});

describe("serverErrors", () => {
  const editor = addSize(editorOf(aProduct()), "n");
  const problem = (status: number, code: string, extra: object = {}) =>
    new ApiError({ type: "about:blank", title: code, status, code, ...extra });

  it("puts each code on its field; size answers on the size of the step", () => {
    expect(serverErrors(problem(409, "CATALOG_SLUG_TAKEN"), editor, { kind: "product" })).toEqual({
      slug: "Đường dẫn này đã được dùng cho món khác. Đặt đường dẫn khác.",
    });
    expect(serverErrors(problem(409, "CATALOG_CATEGORY_ARCHIVED"), editor, { kind: "product" })).toEqual({
      primaryCategoryId: "Danh mục này vừa được lưu trữ. Chọn danh mục khác.",
    });
    expect(
      serverErrors(problem(409, "CATALOG_SKU_TAKEN", { errors: [{ field: "sku", code: "TAKEN", message: "x" }] }), editor, {
        kind: "add",
        index: 2,
      }),
    ).toEqual({ "sizes[2].sku": "Mã SKU này đã được dùng, kể cả bởi món đã lưu trữ. Đặt mã khác." });
    expect(serverErrors(problem(409, "CATALOG_VARIANT_LIMIT_REACHED"), editor, { kind: "add", index: 2 })).toEqual({
      sizes: "Món đã có đủ 20 size. Lưu trữ bớt size cũ trước khi thêm.",
    });
    expect(
      serverErrors(
        problem(400, "VALIDATION_FAILED", { errors: [{ field: "basePrice", code: "X", message: "Giá sai" }] }),
        editor,
        { kind: "size", index: 1 },
      ),
    ).toEqual({ "sizes[1].basePrice": "Giá sai" });
  });
});

describe("activationIssues", () => {
  it("reads issues[] of PRODUCT_ACTIVATION_INVALID, and nothing for other errors", () => {
    const error = problem422([{ code: "NO_ACTIVE_VARIANT" }, { code: "OPTION_CONFIG_INVALID", optionGroupId: "g1" }]);
    expect(activationIssues(error)).toEqual([{ code: "NO_ACTIVE_VARIANT" }, { code: "OPTION_CONFIG_INVALID", optionGroupId: "g1" }]);
    expect(activationIssues(new Error("x"))).toBeNull();
  });
});

function problem422(issues: object[]) {
  return new ApiError({ type: "about:blank", title: "x", status: 422, code: "PRODUCT_ACTIVATION_INVALID", issues } as never);
}
