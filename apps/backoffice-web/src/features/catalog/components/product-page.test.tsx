import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { json, problem } from "../../../test/fake-api";
import { owner, renderAdmin } from "../../branch/test/render-admin";
import type { Product } from "../api/products";
import { aTree } from "../test/categories";
import { aProduct, productResponse } from "../test/products";

const catalogOwner = {
  ...owner,
  storePermissions: [...owner.storePermissions, "CATALOG_VIEW", "CATALOG_MANAGE", "CATALOG_PRICE_MANAGE"],
};
const catalogManager = { ...owner, storePermissions: ["BRANCH_VIEW", "CATALOG_VIEW", "CATALOG_MANAGE"] };
const catalogViewer = { ...owner, storePermissions: ["BRANCH_VIEW", "CATALOG_VIEW"] };

type Variant = Product["variants"][number];

/** The Product the fake server holds; every write answers it with the next version (Decision AE). */
function server(initial: Product = aProduct()) {
  let product = initial;
  const put = (next: Partial<Product>) => {
    product = { ...product, ...next, version: product.version + 1, updatedAt: "2026-11-19T03:00:00Z" };
    return productResponse(product);
  };
  const patchVariant = (variantId: string) => (body: unknown) => {
    const change = body as Partial<Variant>;
    return put({
      variants: product.variants.map((v) =>
        v.variantId === variantId ? { ...v, ...change } : change.isDefault ? { ...v, isDefault: false } : v,
      ),
    });
  };
  return {
    get product() {
      return product;
    },
    /** Someone else changes the Product. */
    change(next: Partial<Product>) {
      product = { ...product, ...next, version: product.version + 1 };
    },
    handlers: {
      "GET /branches": () => json({ items: [] }),
      "GET /categories": () => json(aTree({ archived: true })),
      "GET /products/p-new": () => productResponse(product),
      "PATCH /products/p-new": (body: unknown) => put(body as Partial<Product>),
      "PATCH /products/p-new/variants/v-m": patchVariant("v-m"),
      "PATCH /products/p-new/variants/v-l": patchVariant("v-l"),
      "POST /products/p-new/variants": (body: unknown) => {
        const input = body as { sku: string; name: string; basePrice: number; isDefault?: boolean };
        const added: Variant = {
          variantId: `v-${input.sku}`,
          sku: input.sku,
          name: input.name,
          basePrice: input.basePrice,
          isDefault: input.isDefault ?? false,
          status: "ACTIVE",
          sortOrder: product.variants.length,
        };
        const others = input.isDefault ? product.variants.map((v) => ({ ...v, isDefault: false })) : product.variants;
        const response = put({ variants: [...others, added] });
        return new Response(response.body, { status: 201, headers: response.headers });
      },
      "POST /products/p-new/variants/v-m/archive": () =>
        put({ variants: product.variants.map((v) => (v.variantId === "v-m" ? { ...v, status: "ARCHIVED" as const } : v)) }),
      "POST /products/p-new/activate": () => put({ status: "ACTIVE" }),
      "POST /products/p-new/deactivate": () => put({ status: "INACTIVE" }),
      "POST /products/p-new/archive": () => put({ status: "ARCHIVED", archivedAt: "2026-11-19T03:00:00Z" }),
    },
  };
}

function ifMatchOf(api: ReturnType<typeof renderAdmin>["api"], route: string) {
  return api.calls.filter((c) => c.route === route).map((c) => c.headers.get("If-Match"));
}

const textbox = (name: string) => screen.getByRole<HTMLInputElement>("textbox", { name });
const size = (name: string) => within(screen.getByRole("group", { name: `Size ${name}` }));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Product page (D3d screen 23)", () => {
  it("shows the header with lifecycle steps and the tab Thông tin & size with the Product's values", async () => {
    renderAdmin("/admin/products/p-new", server().handlers, catalogOwner);

    expect(await screen.findByRole("heading", { level: 1, name: "Matcha Đá Xay" })).toBeInTheDocument();
    const header = within(screen.getByRole("region", { name: "Tóm tắt món" }));
    expect(header.getByText("MATCHA-DX")).toBeInTheDocument();
    expect(header.getByText("Nháp")).toBeInTheDocument();
    const actions = within(header.getByRole("group", { name: "Thao tác vòng đời" }));
    expect(actions.getAllByRole("button").map((b) => b.textContent)).toEqual(["Lưu trữ…", "Kích hoạt"]);
    const steps = screen.getByRole("list", { name: "Vòng đời: đang ở Nháp" });
    expect(within(steps).getByText("Nháp")).toHaveAttribute("aria-current", "step");
    expect(screen.getByText("Cập nhật 18/11/2026")).toBeInTheDocument();

    const tabs = within(screen.getByRole("navigation", { name: "Phần của món" }));
    expect(tabs.getByRole("link", { name: "Thông tin & size" })).toHaveAttribute("aria-current", "page");
    expect(textbox("Tên món")).toHaveValue("Matcha Đá Xay");
    expect(textbox("Đường dẫn trên menu (slug)")).toHaveValue("matcha-da-xay");
    await waitFor(() => expect(screen.getByRole("combobox", { name: "Danh mục chính" })).toHaveValue("c-tea"));
    expect(size("M").getByText("MATCHA-DX-M")).toBeInTheDocument();
    expect(size("L").getByRole("radio", { name: "Mặc định" })).toBeChecked();
  });

  it("saves the Product, then size edits, then a new size, each with the latest version", async () => {
    const fake = server();
    const { api, user } = renderAdmin("/admin/products/p-new", fake.handlers, catalogOwner);
    await screen.findByRole("heading", { level: 1, name: "Matcha Đá Xay" });

    await user.clear(textbox("Tên món"));
    await user.type(textbox("Tên món"), "Matcha Kem Muối");
    await user.type(textbox("Mô tả ngắn (không bắt buộc)"), "Mặn nhẹ");
    await user.clear(size("M").getByRole("textbox", { name: "Giá gốc size M (đồng)" }));
    await user.type(size("M").getByRole("textbox", { name: "Giá gốc size M (đồng)" }), "57000");
    await user.click(size("M").getByRole("radio", { name: "Mặc định" }));
    await user.click(screen.getByRole("button", { name: "Thêm size" }));
    expect(textbox("Mã SKU size 3")).toHaveFocus();
    await user.type(textbox("Mã SKU size 3"), "matcha-dx-xl");
    await user.type(textbox("Tên size 3"), "XL");
    await user.type(screen.getByRole("textbox", { name: "Giá gốc size XL (đồng)" }), "75000");
    await user.click(screen.getByRole("button", { name: "Lưu thông tin" }));

    expect(await screen.findByText("Đã lưu thông tin món.")).toBeInTheDocument();
    expect(api.bodyOf("PATCH /products/p-new")).toEqual({ name: "Matcha Kem Muối", shortDescription: "Mặn nhẹ" });
    expect(api.bodyOf("PATCH /products/p-new/variants/v-m")).toEqual({ basePrice: 57000, isDefault: true });
    expect(api.bodyOf("POST /products/p-new/variants")).toEqual({ sku: "MATCHA-DX-XL", name: "XL", basePrice: 75000 });
    expect(ifMatchOf(api, "PATCH /products/p-new")).toEqual(['"v0"']);
    expect(ifMatchOf(api, "PATCH /products/p-new/variants/v-m")).toEqual(['"v1"']);
    expect(ifMatchOf(api, "POST /products/p-new/variants")).toEqual(['"v2"']);
    expect(api.calls.some((c) => c.route === "PATCH /products/p-new/variants/v-l")).toBe(false);

    expect(screen.getByRole("heading", { level: 1, name: "Matcha Kem Muối" })).toBeInTheDocument();
    expect(size("XL").getByText("MATCHA-DX-XL")).toBeInTheDocument();
    expect(screen.getAllByRole("group", { name: /^Size / })).toHaveLength(3);
    expect(size("M").getByRole("radio", { name: "Mặc định" })).toBeChecked();
  });

  it("stops a save at the failed request, puts its error on the field and sends only the rest next time", async () => {
    const fake = server();
    let taken = true;
    const { api, user } = renderAdmin(
      "/admin/products/p-new",
      {
        ...fake.handlers,
        "POST /products/p-new/variants": (body: unknown, request: Request) =>
          taken
            ? json({ type: "about:blank", title: "x", status: 409, code: "CATALOG_SKU_TAKEN", errors: [{ field: "sku", code: "TAKEN" }] }, 409)
            : fake.handlers["POST /products/p-new/variants"](body, request),
      },
      catalogOwner,
    );
    await screen.findByRole("heading", { level: 1, name: "Matcha Đá Xay" });

    await user.clear(textbox("Tên món"));
    await user.type(textbox("Tên món"), "Matcha Mới");
    await user.click(screen.getByRole("button", { name: "Thêm size" }));
    await user.type(textbox("Mã SKU size 3"), "MATCHA-DX-L2");
    await user.type(textbox("Tên size 3"), "L2");
    await user.type(screen.getByRole("textbox", { name: "Giá gốc size L2 (đồng)" }), "70000");
    await user.click(screen.getByRole("button", { name: "Lưu thông tin" }));

    const sku = textbox("Mã SKU size 3");
    await waitFor(() => expect(sku).toHaveAccessibleDescription(/Mã SKU này đã được dùng/));
    expect(sku).toHaveFocus();
    // The name went through: it stays, and the page shows it.
    expect(textbox("Tên món")).toHaveValue("Matcha Mới");
    expect(screen.getByRole("heading", { level: 1, name: "Matcha Mới" })).toBeInTheDocument();

    taken = false;
    await user.clear(sku);
    await user.type(sku, "MATCHA-DX-XXL");
    await user.click(screen.getByRole("button", { name: "Lưu thông tin" }));
    expect(await screen.findByText("Đã lưu thông tin món.")).toBeInTheDocument();
    expect(api.calls.filter((c) => c.route === "PATCH /products/p-new")).toHaveLength(1);
    expect(ifMatchOf(api, "POST /products/p-new/variants")).toEqual(['"v1"', '"v1"']);
  });

  it("lists the issues of PRODUCT_ACTIVATION_INVALID and leads to the field to fix", async () => {
    const fake = server(aProduct({ primaryCategoryId: null }));
    const { user } = renderAdmin(
      "/admin/products/p-new",
      {
        ...fake.handlers,
        "POST /products/p-new/activate": () =>
          json(
            {
              type: "about:blank",
              title: "x",
              status: 422,
              code: "PRODUCT_ACTIVATION_INVALID",
              issues: [{ code: "PRIMARY_CATEGORY_MISSING" }, { code: "NO_ACTIVE_VARIANT" }],
            },
            422,
          ),
      },
      catalogOwner,
    );
    await user.click(await screen.findByRole("button", { name: "Kích hoạt" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Chưa kích hoạt được món này. Sửa các mục sau rồi kích hoạt lại:");
    expect(within(alert).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      "Món chưa có danh mục chính. Chọn danh mục chính ở dưới. Sửa ngay",
      "Món chưa có size nào đang bán. Thêm size ở mục Size và giá gốc. Sửa ngay",
    ]);
    await user.click(within(alert).getAllByRole("link", { name: "Sửa ngay" })[0]!);
    await waitFor(() => expect(screen.getByRole("combobox", { name: "Danh mục chính" })).toHaveFocus());
    expect(screen.getByRole("region", { name: "Tóm tắt món" })).toHaveTextContent("Nháp");
  });

  it("activates, then deactivates after confirming; typed edits stay and save with the new version", async () => {
    const fake = server();
    const { api, user } = renderAdmin("/admin/products/p-new", fake.handlers, catalogOwner);
    await screen.findByRole("heading", { level: 1, name: "Matcha Đá Xay" });
    await user.clear(textbox("Tên món"));
    await user.type(textbox("Tên món"), "Matcha Đang Gõ");

    await user.click(screen.getByRole("button", { name: "Kích hoạt" }));
    expect(await screen.findByText(/Đã kích hoạt món/)).toBeInTheDocument();
    const header = within(screen.getByRole("region", { name: "Tóm tắt món" }));
    expect(header.getByText("Đang bán")).toBeInTheDocument();

    await user.click(header.getByRole("button", { name: "Tạm ngưng…" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Tạm ngưng Matcha Đá Xay?" }));
    await user.click(dialog.getByRole("button", { name: "Tạm ngưng" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(header.getByText("Tạm ngưng")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Vòng đời: đang ở Tạm ngưng" })).toBeInTheDocument();

    expect(textbox("Tên món")).toHaveValue("Matcha Đang Gõ");
    await user.click(screen.getByRole("button", { name: "Lưu thông tin" }));
    expect(await screen.findByText("Đã lưu thông tin món.")).toBeInTheDocument();
    expect(ifMatchOf(api, "PATCH /products/p-new")).toEqual(['"v2"']);
  });

  it("archives the Product after confirming; the tab becomes read-only", async () => {
    const { user } = renderAdmin("/admin/products/p-new", server().handlers, catalogOwner);
    await user.click(await screen.findByRole("button", { name: "Lưu trữ…" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Lưu trữ Matcha Đá Xay?" }));
    expect(dialog.getByText(/Lưu trữ là vĩnh viễn/)).toBeInTheDocument();
    await user.click(dialog.getByRole("button", { name: "Lưu trữ món" }));

    expect(await screen.findByText("Đã lưu trữ món.")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Tóm tắt món" })).toHaveTextContent("Lưu trữ");
    expect(screen.queryByRole("group", { name: "Thao tác vòng đời" })).not.toBeInTheDocument();
    expect(screen.getByText("Món đã lưu trữ nên không sửa được nữa.")).toBeInTheDocument();
    expect(textbox("Tên món")).toHaveAttribute("readonly");
    expect(screen.queryByRole("button", { name: "Lưu thông tin" })).not.toBeInTheDocument();
  });

  it("archives a size after confirming", async () => {
    const { user } = renderAdmin("/admin/products/p-new", server().handlers, catalogOwner);
    await screen.findByRole("heading", { level: 1, name: "Matcha Đá Xay" });
    await user.click(size("M").getByRole("button", { name: "Lưu trữ size…" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Lưu trữ size M?" }));
    await user.click(dialog.getByRole("button", { name: "Lưu trữ size" }));

    expect(await screen.findByText("Đã lưu trữ size.")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Size M" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("group", { name: /^Size / })).toHaveLength(1);
  });

  it("on 412 VERSION_CONFLICT keeps what was typed and saves with the new version after Tải lại", async () => {
    const fake = server();
    const { api, user } = renderAdmin(
      "/admin/products/p-new",
      {
        ...fake.handlers,
        "PATCH /products/p-new": (body: unknown, request: Request) =>
          request.headers.get("If-Match") === `"v${fake.product.version}"`
            ? fake.handlers["PATCH /products/p-new"](body, request)
            : problem(412, "VERSION_CONFLICT"),
      },
      catalogOwner,
    );
    await screen.findByRole("heading", { level: 1, name: "Matcha Đá Xay" });
    await user.clear(textbox("Tên món"));
    await user.type(textbox("Tên món"), "Tên của tôi");

    // Someone else changes the slug meanwhile.
    fake.change({ slug: "slug-moi" });
    await user.click(screen.getByRole("button", { name: "Lưu thông tin" }));
    expect(await screen.findByText(/Món vừa được người khác cập nhật/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Tải lại" }));
    await waitFor(() => expect(textbox("Đường dẫn trên menu (slug)")).toHaveValue("slug-moi"));
    expect(textbox("Tên món")).toHaveValue("Tên của tôi");

    await user.click(screen.getByRole("button", { name: "Lưu thông tin" }));
    expect(await screen.findByText("Đã lưu thông tin món.")).toBeInTheDocument();
    expect(ifMatchOf(api, "PATCH /products/p-new")).toEqual(['"v0"', '"v1"']);
    expect(api.bodyOf("PATCH /products/p-new")).toEqual({ name: "Tên của tôi" });
  });

  it("is read-only without CATALOG_MANAGE", async () => {
    renderAdmin("/admin/products/p-new", server().handlers, catalogViewer);
    await screen.findByRole("heading", { level: 1, name: "Matcha Đá Xay" });
    expect(screen.queryByRole("group", { name: "Thao tác vòng đời" })).not.toBeInTheDocument();
    expect(textbox("Tên món")).toHaveAttribute("readonly");
    expect(screen.queryByRole("button", { name: "Lưu thông tin" })).not.toBeInTheDocument();
  });

  it("keeps base prices read-only and offers no new size without CATALOG_PRICE_MANAGE", async () => {
    renderAdmin("/admin/products/p-new", server().handlers, catalogManager);
    await screen.findByRole("heading", { level: 1, name: "Matcha Đá Xay" });
    expect(textbox("Tên món")).not.toHaveAttribute("readonly");
    expect(size("M").getByRole("textbox", { name: "Giá gốc size M (đồng)" })).toHaveAttribute("readonly");
    expect(screen.queryByRole("button", { name: "Thêm size" })).not.toBeInTheDocument();
    expect(screen.getByText(/không có quyền quản lý giá/)).toBeInTheDocument();
  });
});
