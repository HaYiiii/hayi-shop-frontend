import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { json, problem } from "../../../test/fake-api";
import { owner, renderAdmin } from "../../branch/test/render-admin";
import type { Collection, Tag } from "../api/collections";
import { aPage, aProductSummary } from "../test/products";

const catalogOwner = { ...owner, storePermissions: [...owner.storePermissions, "CATALOG_VIEW", "CATALOG_MANAGE"] };
const catalogViewer = { ...owner, storePermissions: ["BRANCH_VIEW", "CATALOG_VIEW"] };

const collection = (collectionId: string, name: string, sortOrder: number, productIds: string[], version = 2): Collection => ({
  collectionId,
  slug: collectionId,
  name,
  description: null,
  status: "ACTIVE",
  sortOrder,
  productIds,
  version,
  createdAt: "2026-11-01T03:00:00Z",
  updatedAt: "2026-11-01T03:00:00Z",
});
const tag = (tagId: string, name: string): Tag => ({ tagId, slug: tagId, name, createdAt: "2026-11-01T03:00:00Z" });

const products = [
  aProductSummary({ productId: "p-bido", productCode: "MATCHA-BIDO", name: "Matcha Bí Đỏ" }),
  aProductSummary({ productId: "p-hatde", productCode: "HOJICHA-HATDE", name: "Hojicha Hạt Dẻ" }),
  aProductSummary({ productId: "p-gung", productCode: "TRA-GUNG", name: "Trà Gừng", status: "DRAFT" }),
];

function server() {
  let collections = [collection("mua-thu", "Mùa thu 2026", 0, ["p-bido", "p-hatde"]), collection("ban-chay", "Bán chạy", 1, ["p-gung"])];
  let tags = [tag("it-ngot", "Ít ngọt")];
  const replace = (id: string, change: Partial<Collection>) => {
    const old = collections.find((c) => c.collectionId === id)!;
    const next = { ...old, ...change, version: old.version + 1 };
    collections = collections.map((c) => (c.collectionId === id ? next : c)).sort((a, b) => a.sortOrder - b.sortOrder);
    return json(next);
  };
  return {
    handlers: {
      "GET /branches": () => json({ items: [] }),
      "GET /collections": () => json({ items: collections }),
      "GET /products": () => json(aPage(products)),
      "GET /tags": () => json({ items: tags }),
      "POST /collections": (body: unknown) => {
        const input = body as { name: string; slug: string };
        const created = collection(input.slug, input.name, collections.length, [], 0);
        collections = [...collections, created];
        return json(created, 201);
      },
      "PATCH /collections/mua-thu": (body: unknown) => replace("mua-thu", body as Partial<Collection>),
      "PATCH /collections/ban-chay": (body: unknown) => replace("ban-chay", body as Partial<Collection>),
      "PUT /collections/mua-thu/products": (body: unknown) => replace("mua-thu", body as Partial<Collection>),
      "POST /tags": (body: unknown) => {
        const input = body as { name: string; slug: string };
        tags = [...tags, tag(input.slug, input.name)];
        return json(tags.at(-1), 201);
      },
      "PATCH /tags/it-ngot": (body: unknown) => {
        tags = tags.map((t) => (t.tagId === "it-ngot" ? { ...t, ...(body as Partial<Tag>) } : t));
        return json(tags[0]);
      },
    },
  };
}

function ifMatchOf(api: ReturnType<typeof renderAdmin>["api"], route: string) {
  return api.calls.filter((c) => c.route === route).map((c) => c.headers.get("If-Match"));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Collections & tags (D3d screen 28)", () => {
  it("is a link under Quản trị; lists collections with their product count and opens the first", async () => {
    renderAdmin("/admin/collections", server().handlers, catalogOwner);
    expect(await screen.findByRole("heading", { level: 1, name: "Bộ sưu tập & tag" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Bộ sưu tập & tag" })).toHaveAttribute("aria-current", "page");
    const list = within(screen.getByRole("region", { name: "Bộ sưu tập" }));
    expect(await list.findByRole("button", { name: /^Mùa thu 2026.*2 món/ })).toHaveAttribute("aria-current", "true");
    const items = within(await screen.findByRole("list", { name: "Món trong bộ sưu tập, theo thứ tự hiển thị" }));
    expect(await items.findByText("Matcha Bí Đỏ")).toBeInTheDocument();
    expect(items.getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      expect.stringContaining("Matcha Bí Đỏ"),
      expect.stringContaining("Hojicha Hạt Dẻ"),
    ]);
  });

  it("renames, reorders, removes and adds products, then saves fields and products with the latest version", async () => {
    const { api, user } = renderAdmin("/admin/collections", server().handlers, catalogOwner);
    const editor = within(await screen.findByRole("region", { name: "Mùa thu 2026" }));
    await editor.findByText("Hojicha Hạt Dẻ");

    await user.clear(editor.getByLabelText("Tên (khách thấy)"));
    await user.type(editor.getByLabelText("Tên (khách thấy)"), "Mùa thu");
    await user.click(editor.getByRole("button", { name: "Chuyển Hojicha Hạt Dẻ lên" }));
    await user.click(editor.getByRole("button", { name: "Bỏ Matcha Bí Đỏ khỏi bộ sưu tập" }));
    await user.selectOptions(editor.getByLabelText("Thêm món vào bộ sưu tập"), "Trà Gừng · TRA-GUNG");
    await user.click(editor.getByRole("button", { name: "Thêm" }));
    await user.click(editor.getByRole("button", { name: "Lưu bộ sưu tập" }));

    await waitFor(() => expect(api.bodyOf("PUT /collections/mua-thu/products")).toEqual({ productIds: ["p-hatde", "p-gung"] }));
    expect(api.bodyOf("PATCH /collections/mua-thu")).toEqual({ name: "Mùa thu" });
    expect(ifMatchOf(api, "PATCH /collections/mua-thu")).toEqual(['"v2"']);
    expect(ifMatchOf(api, "PUT /collections/mua-thu/products")).toEqual(['"v3"']);
    expect(await editor.findByText(/^Đã lưu bộ sưu tập/)).toBeInTheDocument();
    expect(editor.getByLabelText("Tên (khách thấy)")).toHaveValue("Mùa thu");
  });

  it("on a version conflict, Tải lại keeps the typed name on top of the newer collection", async () => {
    const fake = server();
    let newer = false;
    const { api, user } = renderAdmin(
      "/admin/collections",
      {
        ...fake.handlers,
        "GET /collections": () =>
          json({ items: [newer ? collection("mua-thu", "Thu 2026", 0, ["p-bido", "p-hatde"], 3) : collection("mua-thu", "Mùa thu 2026", 0, ["p-bido"])] }),
        "PATCH /collections/mua-thu": () => {
          if (newer) return json(collection("mua-thu", "Mùa thu", 0, ["p-bido", "p-hatde"], 4));
          newer = true;
          return problem(412, "VERSION_CONFLICT");
        },
      },
      catalogOwner,
    );
    const editor = within(await screen.findByRole("region", { name: "Mùa thu 2026" }));
    await user.clear(editor.getByLabelText("Tên (khách thấy)"));
    await user.type(editor.getByLabelText("Tên (khách thấy)"), "Mùa thu");
    await user.click(editor.getByRole("button", { name: "Lưu bộ sưu tập" }));
    expect(await editor.findByText("Bộ sưu tập vừa được người khác cập nhật. Tải lại rồi lưu lại.")).toBeInTheDocument();
    await user.click(editor.getByRole("button", { name: "Tải lại" }));
    const reloaded = within(await screen.findByRole("region", { name: "Thu 2026" }));
    expect(reloaded.getByLabelText("Tên (khách thấy)")).toHaveValue("Mùa thu");
    expect(await reloaded.findByText("Hojicha Hạt Dẻ")).toBeInTheDocument();
    expect(reloaded.queryByText(/người khác cập nhật/)).not.toBeInTheDocument();
    await user.click(reloaded.getByRole("button", { name: "Lưu bộ sưu tập" }));
    await waitFor(() => expect(ifMatchOf(api, "PATCH /collections/mua-thu")).toEqual(['"v2"', '"v3"']));
    expect(api.calls.filter((c) => c.route === "PUT /collections/mua-thu/products")).toHaveLength(0);
  });

  it("after the fields saved but the product list failed, the next save starts from the saved version", async () => {
    const fake = server();
    let failPut = true;
    const { api, user } = renderAdmin(
      "/admin/collections",
      {
        ...fake.handlers,
        // Once the PUT has failed, Hojicha Hạt Dẻ is archived: the list no longer has it.
        "GET /products": () => json(aPage(failPut ? products : products.filter((p) => p.productId !== "p-hatde"))),
        "PUT /collections/mua-thu/products": (body: unknown) => {
          if (failPut) {
            failPut = false;
            return problem(409, "CATALOG_PRODUCT_ARCHIVED");
          }
          return fake.handlers["PUT /collections/mua-thu/products"](body);
        },
      },
      catalogOwner,
    );
    const editor = within(await screen.findByRole("region", { name: "Mùa thu 2026" }));
    await editor.findByText("Hojicha Hạt Dẻ");
    await user.clear(editor.getByLabelText("Tên (khách thấy)"));
    await user.type(editor.getByLabelText("Tên (khách thấy)"), "Mùa thu");
    await user.click(editor.getByRole("button", { name: "Bỏ Matcha Bí Đỏ khỏi bộ sưu tập" }));
    await user.click(editor.getByRole("button", { name: "Lưu bộ sưu tập" }));
    expect(await editor.findByText("Hojicha Hạt Dẻ vừa được lưu trữ hoặc xoá. Bỏ món đó khỏi danh sách rồi lưu lại.")).toBeInTheDocument();

    await user.click(editor.getByRole("button", { name: "Lưu bộ sưu tập" }));
    expect(await screen.findByText(/^Đã lưu bộ sưu tập/)).toBeInTheDocument();
    expect(ifMatchOf(api, "PATCH /collections/mua-thu")).toEqual(['"v2"']);
    expect(ifMatchOf(api, "PUT /collections/mua-thu/products")).toEqual(['"v3"', '"v3"']);
  });

  it("moves a collection down by swapping the two sortOrders", async () => {
    const { api, user } = renderAdmin("/admin/collections", server().handlers, catalogOwner);
    await user.click(await screen.findByRole("button", { name: "Chuyển Mùa thu 2026 xuống" }));
    await waitFor(() => expect(api.bodyOf("PATCH /collections/ban-chay")).toEqual({ sortOrder: 0 }));
    expect(api.bodyOf("PATCH /collections/mua-thu")).toEqual({ sortOrder: 1 });
  });

  it("creates a collection (the slug follows the name) and opens it", async () => {
    const { api, user, router } = renderAdmin("/admin/collections", server().handlers, catalogOwner);
    await user.click(await screen.findByRole("button", { name: "+ Tạo" }));
    const form = within(screen.getByRole("form", { name: "Tạo bộ sưu tập" }));
    await user.type(form.getByLabelText("Tên (khách thấy)"), "Không cà phê");
    expect(form.getByLabelText("Đường dẫn (slug)")).toHaveValue("khong-ca-phe");
    await user.click(form.getByRole("button", { name: "Tạo bộ sưu tập" }));
    await waitFor(() => expect(router.state.location.search).toEqual({ c: "khong-ca-phe" }));
    expect(api.bodyOf("POST /collections")).toEqual({ name: "Không cà phê", slug: "khong-ca-phe" });
    expect(await screen.findByRole("region", { name: "Không cà phê" })).toBeInTheDocument();
  });

  it("shows CATALOG_SLUG_TAKEN under the slug", async () => {
    const fake = server();
    const { user } = renderAdmin("/admin/collections", { ...fake.handlers, "POST /collections": () => problem(409, "CATALOG_SLUG_TAKEN") }, catalogOwner);
    await user.click(await screen.findByRole("button", { name: "+ Tạo" }));
    const form = within(screen.getByRole("form", { name: "Tạo bộ sưu tập" }));
    await user.type(form.getByLabelText("Tên (khách thấy)"), "Mùa thu");
    await user.click(form.getByRole("button", { name: "Tạo bộ sưu tập" }));
    expect(await form.findByText("Đường dẫn này đã được dùng. Đặt đường dẫn khác.")).toBeInTheDocument();
  });

  it("adds and renames a tag", async () => {
    const { api, user } = renderAdmin("/admin/collections", server().handlers, catalogOwner);
    const tags = within(await screen.findByRole("region", { name: "Tag" }));
    await user.type(await tags.findByLabelText("Tag mới"), "Mùa thu");
    expect(tags.getByLabelText("Đường dẫn tag")).toHaveValue("mua-thu");
    await user.click(tags.getByRole("button", { name: "Thêm" }));
    expect(await tags.findByText("Đã thêm tag.")).toBeInTheDocument();
    expect(api.bodyOf("POST /tags")).toEqual({ name: "Mùa thu", slug: "mua-thu" });

    await user.click(tags.getByRole("button", { name: "Sửa tag Ít ngọt" }));
    await user.clear(tags.getByLabelText("Tên tag Ít ngọt"));
    await user.type(tags.getByLabelText("Tên tag Ít ngọt"), "Ít đường");
    await user.click(tags.getByRole("button", { name: "Lưu" }));
    await waitFor(() => expect(api.bodyOf("PATCH /tags/it-ngot")).toEqual({ name: "Ít đường" }));
    expect(await tags.findByText("Ít đường")).toBeInTheDocument();
  });

  it("is read-only without CATALOG_MANAGE", async () => {
    renderAdmin("/admin/collections", server().handlers, catalogViewer);
    await screen.findByRole("region", { name: "Mùa thu 2026" });
    expect(screen.queryByRole("button", { name: "+ Tạo" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Lưu bộ sưu tập" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Tag mới")).not.toBeInTheDocument();
  });
});
