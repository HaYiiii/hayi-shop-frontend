import { describe, expect, it } from "vitest";
import {
  activeTree,
  countArchived,
  createBody,
  fieldErrors,
  isSlug,
  localErrors,
  moveRequest,
  patchBody,
  slugify,
} from "./category-form";
import { aCategory, aTree } from "./test/categories";

describe("slugify", () => {
  it.each([
    ["Trà sữa đá xay", "tra-sua-da-xay"],
    ["  Matcha   Latte! ", "matcha-latte"],
    ["Đặc biệt — mùa hè", "dac-biet-mua-he"],
    ["Cà phê 100%", "ca-phe-100"],
  ])("%s → %s", (name, slug) => {
    expect(slugify(name)).toBe(slug);
    expect(isSlug(slug)).toBe(true);
  });

  it("stays within 128 characters without a trailing dash", () => {
    const slug = slugify(`${"a".repeat(127)} b`);
    expect(slug).toHaveLength(127);
    expect(isSlug(slug)).toBe(true);
  });
});

describe("localErrors", () => {
  it("asks for a name and a kebab-case slug", () => {
    expect(localErrors({ name: "", slug: "Tra Sua", parentId: "", description: "" })).toEqual({
      name: "Nhập tên danh mục.",
      slug: "Chỉ dùng chữ thường không dấu, số và dấu gạch ngang, ví dụ tra-trai-cay.",
    });
    expect(localErrors({ name: "Trà", slug: "tra", parentId: "", description: "" })).toEqual({});
  });
});

describe("createBody / patchBody", () => {
  it("leaves out an empty description and parent on create", () => {
    expect(createBody({ name: "Bánh", slug: "banh", parentId: "", description: "" })).toEqual({ name: "Bánh", slug: "banh" });
    expect(createBody({ name: "Trà vải", slug: "tra-vai", parentId: "c-tea", description: "Mát" })).toEqual({
      name: "Trà vải",
      slug: "tra-vai",
      parentId: "c-tea",
      description: "Mát",
    });
  });

  it("sends only changed fields; emptying description or parent sends null", () => {
    const child = aCategory({ categoryId: "c-x", parentId: "c-tea", description: "Cũ" });
    expect(patchBody(child, { name: "Trà", slug: "tra", parentId: "c-tea", description: "Cũ" })).toEqual({});
    expect(patchBody(child, { name: "Trà mới", slug: "tra", parentId: "", description: "" })).toEqual({
      name: "Trà mới",
      parentId: null,
      description: null,
    });
  });
});

describe("fieldErrors", () => {
  it("maps VALIDATION_FAILED errors to form fields", () => {
    expect(
      fieldErrors([
        { field: "name", message: "Tên tối đa 128 ký tự." },
        { field: "If-Match", message: "x" },
      ]),
    ).toEqual({ name: "Tên tối đa 128 ký tự." });
  });
});

describe("moveRequest", () => {
  const tree = aTree({ archived: true }).items;

  it("swaps a root with its neighbour and lists every active root", () => {
    expect(moveRequest(tree, "c-milk", "up")).toEqual({ parentId: null, categoryIds: ["c-milk", "c-tea"] });
  });

  it("moves a child inside its parent", () => {
    expect(moveRequest(tree, "c-tea-lychee", "down")).toEqual({
      parentId: "c-tea",
      categoryIds: ["c-tea-peach", "c-tea-lychee"],
    });
  });

  it("does nothing at the ends of a group", () => {
    expect(moveRequest(tree, "c-tea", "up")).toBeNull();
    expect(moveRequest(tree, "c-milk", "down")).toBeNull();
  });
});

describe("activeTree / countArchived", () => {
  it("hides archived Categories and counts them", () => {
    const tree = aTree({ archived: true }).items;
    expect(activeTree(tree).map((c) => c.categoryId)).toEqual(["c-tea", "c-milk"]);
    expect(countArchived(tree)).toBe(1);
  });
});
