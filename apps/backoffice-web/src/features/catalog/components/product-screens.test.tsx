import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { json, problem } from "../../../test/fake-api";
import { owner, renderAdmin } from "../../branch/test/render-admin";
import type { ProductPage } from "../api/products";
import { aTree } from "../test/categories";
import { aPage, aProduct, aProductSummary, productResponse } from "../test/products";

const catalogOwner = {
  ...owner,
  storePermissions: [...owner.storePermissions, "CATALOG_VIEW", "CATALOG_MANAGE", "CATALOG_PRICE_MANAGE"],
};
const catalogViewer = { ...owner, storePermissions: ["BRANCH_VIEW", "CATALOG_VIEW"] };

const products = [
  aProductSummary(),
  aProductSummary({
    productId: "p-cake",
    productCode: "CAKE",
    name: "Bánh Bông Lan",
    status: "DRAFT",
    primaryCategoryId: null,
    fromPrice: 39000,
    variantCount: 1,
  }),
  aProductSummary({ productId: "p-old", productCode: "OLD", name: "Trà Cũ", status: "ARCHIVED", primaryCategoryId: "c-old" }),
];

/** The fake server; `GET /products` answers `page` and records each query string. */
function server(page: ProductPage | ((query: URLSearchParams) => ProductPage) = aPage(products)) {
  const queries: URLSearchParams[] = [];
  return {
    queries,
    lastQuery: () => queries.at(-1)!,
    handlers: {
      "GET /branches": () => json({ items: [] }),
      "GET /categories": () => json(aTree({ archived: true })),
      "GET /products": (_body: unknown, request: Request) => {
        const query = new URL(request.url).searchParams;
        queries.push(query);
        return json(typeof page === "function" ? page(query) : page);
      },
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Product list (D3d screen 21)", () => {
  it("is a Món link under Quản trị and lists Products with category, from-price and status", async () => {
    renderAdmin("/admin/products", server().handlers, catalogOwner);

    expect(await screen.findByRole("heading", { level: 1, name: "Món" })).toBeInTheDocument();
    const nav = within(screen.getByRole("region", { name: "Quản trị" }));
    expect(nav.getAllByRole("link").map((a) => a.textContent)).toEqual(["Chi nhánh", "Món", "Danh mục"]);
    expect(nav.getByRole("link", { name: "Món" })).toHaveAttribute("aria-current", "page");
    expect(await screen.findByText("3 món")).toBeInTheDocument();

    const table = screen.getByRole("table", { name: "Danh sách món" });
    const latte = within(within(table).getByRole("row", { name: /Matcha Latte/ }));
    expect(latte.getByText("MATCHA-LATTE")).toBeInTheDocument();
    expect(await latte.findByText("Trà vải")).toBeInTheDocument();
    expect(latte.getByText("Từ 45.000 ₫ · 2 size")).toBeInTheDocument();
    expect(latte.getByText("Đang bán")).toBeInTheDocument();
    expect(latte.getByText("04/11/2026")).toBeInTheDocument();
    expect(latte.getByRole("link", { name: "Xem Matcha Latte" })).toHaveAttribute("href", "/admin/products/p-latte");

    const cake = within(within(table).getByRole("row", { name: /Bánh Bông Lan/ }));
    expect(cake.getByText("39.000 ₫")).toBeInTheDocument();
    expect(cake.getByText("Chưa chọn")).toBeInTheDocument();
    expect(cake.getByText("Nháp")).toBeInTheDocument();
    // An archived primary Category still has its name.
    const old = within(within(table).getByRole("row", { name: /Trà Cũ/ }));
    expect(old.getByText("Món cũ")).toBeInTheDocument();
    expect(old.getByText("Lưu trữ")).toBeInTheDocument();
  });

  it("filters by status, category and search, keeping the filters in the URL", async () => {
    const fake = server();
    const { router, user } = renderAdmin("/admin/products", fake.handlers, catalogOwner);
    await screen.findByText("3 món");
    expect(fake.lastQuery().get("size")).toBe("20");
    expect(fake.lastQuery().has("status")).toBe(false);

    await user.click(screen.getByRole("button", { name: "Nháp" }));
    await waitFor(() => expect(fake.lastQuery().get("status")).toBe("DRAFT"));
    expect(screen.getByRole("button", { name: "Nháp" })).toHaveAttribute("aria-pressed", "true");
    expect(router.state.location.search).toEqual({ status: "DRAFT" });

    const category = screen.getByRole("combobox", { name: "Danh mục" });
    expect(within(category).getAllByRole("option").map((o) => o.textContent)).toEqual([
      "Mọi danh mục",
      "Trà",
      "— Trà vải",
      "— Trà đào",
      "Sữa chua",
    ]);
    await user.selectOptions(category, "— Trà vải");
    await waitFor(() => expect(fake.lastQuery().get("categoryId")).toBe("c-tea-lychee"));

    await user.type(screen.getByRole("searchbox", { name: "Tìm món" }), "latte");
    await waitFor(() => expect(fake.lastQuery().get("q")).toBe("latte"));
    expect(router.state.location.search).toEqual({ status: "DRAFT", categoryId: "c-tea-lychee", q: "latte" });

    await user.click(screen.getByRole("button", { name: "Tất cả" }));
    await waitFor(() => expect(fake.lastQuery().has("status")).toBe(false));
  });

  it("pages through the results", async () => {
    const fake = server((query) =>
      aPage([aProductSummary({ productId: `p-${query.get("page") ?? 0}` })], {
        number: Number(query.get("page") ?? 0),
        totalItems: 25,
        totalPages: 2,
      }),
    );
    const { user } = renderAdmin("/admin/products", fake.handlers, catalogOwner);

    expect(await screen.findByText("1–20 trên 25 món")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Trang trước" })).toHaveAttribute("aria-disabled", "true");
    await user.click(screen.getByRole("button", { name: "Trang sau" }));

    expect(await screen.findByText("21–25 trên 25 món")).toBeInTheDocument();
    expect(fake.lastQuery().get("page")).toBe("1");
    expect(screen.getByRole("button", { name: "Trang sau" })).toHaveAttribute("aria-disabled", "true");
  });

  it("says when there is no Product yet, or none matches the filters", async () => {
    const fake = server(aPage([]));
    const { user } = renderAdmin("/admin/products", fake.handlers, catalogOwner);

    expect(await screen.findByText("Chưa có món nào. Bấm Tạo món để thêm món đầu tiên.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Tạm ngưng" }));
    expect(await screen.findByText("Không có món nào khớp bộ lọc.")).toBeInTheDocument();
  });

  it("clears the search box when q leaves the URL another way", async () => {
    const fake = server();
    const { router, user } = renderAdmin("/admin/products?q=matcha", fake.handlers, catalogOwner);
    expect(await screen.findByRole("searchbox", { name: "Tìm món" })).toHaveValue("matcha");

    // The sidebar link opens the list without search.
    await user.click(within(screen.getByRole("region", { name: "Quản trị" })).getByRole("link", { name: "Món" }));

    await waitFor(() => expect(screen.getByRole("searchbox", { name: "Tìm món" })).toHaveValue(""));
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(router.state.location.search).toEqual({});
  });

  it("offers the first page when a page past the end is opened", async () => {
    const fake = server((query) =>
      query.get("page") ? aPage([], { number: 4, totalItems: 3, totalPages: 1 }) : aPage(products),
    );
    const { router, user } = renderAdmin("/admin/products?page=4", fake.handlers, catalogOwner);

    expect(await screen.findByText("Trang này không còn món nào.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Về trang đầu" }));
    expect(await screen.findByText("3 món")).toBeInTheDocument();
    expect(router.state.location.search).toEqual({});
  });

  it("shows an error with a retry", async () => {
    let fail = true;
    const fake = server();
    const { user } = renderAdmin(
      "/admin/products",
      { ...fake.handlers, "GET /products": () => (fail ? problem(503, "SERVICE_UNAVAILABLE") : json(aPage(products))) },
      catalogOwner,
    );

    expect(await screen.findByText("Chưa tải được danh sách món. Kiểm tra mạng rồi thử lại.")).toBeInTheDocument();
    fail = false;
    await user.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(await screen.findByText("3 món")).toBeInTheDocument();
  });

  it("offers Tạo món only with CATALOG_MANAGE and CATALOG_PRICE_MANAGE", async () => {
    renderAdmin("/admin/products", server().handlers, catalogViewer);

    expect(await screen.findByText("3 món")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Tạo món" })).not.toBeInTheDocument();
  });
});

describe("Product create (D3d screen 22)", () => {
  function createServer(answer: (body: unknown) => Response) {
    const fake = server();
    return {
      ...fake,
      handlers: {
        ...fake.handlers,
        "POST /products": answer,
        "GET /products/p-new": () => productResponse(aProduct()),
      },
    };
  }

  it("creates a DRAFT Product with two sizes and opens it", async () => {
    const fake = createServer(() => productResponse(aProduct(), 201));
    const { api, router, user } = renderAdmin("/admin/products", fake.handlers, catalogOwner);

    await user.click(await screen.findByRole("link", { name: "Tạo món" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Tạo món" })).toBeInTheDocument();

    await user.type(screen.getByRole("textbox", { name: "Tên món" }), "Matcha Đá Xay");
    expect(screen.getByRole("textbox", { name: "Đường dẫn trên menu (slug)" })).toHaveValue("matcha-da-xay");
    await user.type(screen.getByRole("textbox", { name: "Mã món" }), "matcha-dx");
    await user.selectOptions(await screen.findByRole("combobox", { name: "Danh mục chính" }), "Trà");

    const size1 = within(screen.getByRole("group", { name: "Size 1" }));
    await user.type(size1.getByRole("textbox", { name: "Mã SKU size 1" }), "matcha-dx-m");
    await user.type(size1.getByRole("textbox", { name: "Tên size 1" }), "M");
    await user.type(size1.getByRole("textbox", { name: "Giá gốc size 1 (đồng)" }), "55000");
    await user.tab();
    const price1 = size1.getByRole<HTMLInputElement>("textbox", { name: "Giá gốc size 1 (đồng)" });
    expect(price1.value.replace(/\s/g, " ")).toBe("55.000 ₫");

    await user.click(screen.getByRole("button", { name: "Thêm size" }));
    const size2 = within(screen.getByRole("group", { name: "Size 2" }));
    expect(size2.getByRole("textbox", { name: "Mã SKU size 2" })).toHaveFocus();
    await user.type(size2.getByRole("textbox", { name: "Mã SKU size 2" }), "MATCHA-DX-L");
    await user.type(size2.getByRole("textbox", { name: "Tên size 2" }), "L");
    await user.type(size2.getByRole("textbox", { name: "Giá gốc size 2 (đồng)" }), "65.000");
    await user.click(size2.getByRole("radio", { name: "Mặc định" }));

    await user.click(screen.getByRole("button", { name: "Tạo món" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/products/p-new"));
    expect(api.bodyOf("POST /products")).toEqual({
      productCode: "MATCHA-DX",
      name: "Matcha Đá Xay",
      slug: "matcha-da-xay",
      primaryCategoryId: "c-tea",
      variants: [
        { sku: "MATCHA-DX-M", name: "M", basePrice: 55000, isDefault: false },
        { sku: "MATCHA-DX-L", name: "L", basePrice: 65000, isDefault: true },
      ],
    });
    expect(await screen.findByRole("heading", { level: 1, name: "Matcha Đá Xay" })).toBeInTheDocument();
    expect(screen.getByText("Đã tạo món ở trạng thái Nháp.")).toBeInTheDocument();
    // Shown once: the flag leaves the URL, so a reload does not repeat it.
    await waitFor(() => expect(router.state.location.search).toEqual({}));
    expect(screen.getByText("Đã tạo món ở trạng thái Nháp.")).toBeInTheDocument();
    const sizes = within(screen.getByRole("table", { name: "Size và giá gốc" }));
    expect(sizes.getByRole("row", { name: /MATCHA-DX-L/ })).toHaveTextContent("65.000 ₫");
    expect(sizes.getByRole("row", { name: /MATCHA-DX-L/ })).toHaveTextContent("Mặc định");
  });

  it("checks the form before sending and puts the keyboard on the first error", async () => {
    const fake = createServer(() => productResponse(aProduct(), 201));
    const { api, user } = renderAdmin("/admin/products/new", fake.handlers, catalogOwner);

    await user.click(await screen.findByRole("button", { name: "Tạo món" }));

    expect(screen.getByRole("textbox", { name: "Tên món" })).toHaveFocus();
    expect(screen.getByRole("textbox", { name: "Tên món" })).toHaveAccessibleDescription("Nhập tên món.");
    expect(screen.getByRole("textbox", { name: "Mã SKU size 1" })).toHaveAccessibleDescription("Nhập mã SKU.");
    expect(api.calls.some((c) => c.route === "POST /products")).toBe(false);
  });

  it("puts CATALOG_SKU_TAKEN and CATALOG_SLUG_TAKEN on their field", async () => {
    let code = "CATALOG_SKU_TAKEN";
    const fake = createServer(() => problem(409, code));
    const { user } = renderAdmin("/admin/products/new", fake.handlers, catalogOwner);

    await user.type(await screen.findByRole("textbox", { name: "Tên món" }), "Bạc Xỉu");
    await user.type(screen.getByRole("textbox", { name: "Mã món" }), "BAC-XIU");
    await user.type(screen.getByRole("textbox", { name: "Mã SKU size 1" }), "BAC-XIU");
    await user.type(screen.getByRole("textbox", { name: "Tên size 1" }), "Standard");
    await user.type(screen.getByRole("textbox", { name: "Giá gốc size 1 (đồng)" }), "35000");
    await user.click(screen.getByRole("button", { name: "Tạo món" }));

    const sku = screen.getByRole("textbox", { name: "Mã SKU size 1" });
    await waitFor(() => expect(sku).toHaveAttribute("aria-invalid", "true"));
    expect(sku).toHaveAccessibleDescription("Mã SKU này đã được dùng, kể cả bởi món đã lưu trữ. Đặt mã khác.");
    expect(sku).toHaveFocus();

    code = "CATALOG_SLUG_TAKEN";
    await user.click(screen.getByRole("button", { name: "Tạo món" }));
    const slug = screen.getByRole("textbox", { name: "Đường dẫn trên menu (slug)" });
    await waitFor(() => expect(slug).toHaveAccessibleDescription("Đường dẫn này đã được dùng cho món khác. Đặt đường dẫn khác."));
    expect(sku).not.toHaveAttribute("aria-invalid");
  });

  it("removes a size and keeps one default", async () => {
    const fake = createServer(() => productResponse(aProduct(), 201));
    const { user } = renderAdmin("/admin/products/new", fake.handlers, catalogOwner);

    expect(await screen.findByRole("button", { name: "Xoá size 1" })).toHaveAttribute("aria-disabled", "true");
    await user.click(screen.getByRole("button", { name: "Thêm size" }));
    await user.click(screen.getByRole("button", { name: "Xoá size 1" }));

    expect(screen.queryByRole("group", { name: "Size 2" })).not.toBeInTheDocument();
    expect(within(screen.getByRole("group", { name: "Size 1" })).getByRole("radio", { name: "Mặc định" })).toBeChecked();
    expect(screen.getByRole("button", { name: "Thêm size" })).toHaveFocus();
  });

  it("is not offered without CATALOG_PRICE_MANAGE", async () => {
    renderAdmin("/admin/products/new", server().handlers, {
      ...owner,
      storePermissions: ["BRANCH_VIEW", "CATALOG_VIEW", "CATALOG_MANAGE"],
    });

    expect(await screen.findByText("Bạn không có quyền xem màn này ở phạm vi đang chọn.")).toBeInTheDocument();
  });
});
