import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { aProductDetail } from "../../../../../../features/product/test/product";
import ProductPage from "./page";

vi.mock("next/server", () => ({ connection: () => Promise.resolve() }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));

const branch = {
  branchId: "b-q1",
  branchCode: "Q1-LELOI",
  name: "Quận 1 · Lê Lợi",
  address: { line: "12 Lê Lợi", ward: "Bến Nghé", district: "Quận 1" },
  openNow: true,
  earliestPickupAt: null,
};

/** Answers by path: the Branch list, then the product. */
function serve(product: () => Response) {
  const calls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((input: Request | string) => {
      const url = new URL(typeof input === "string" ? input : input.url);
      calls.push(url.pathname);
      return Promise.resolve(url.pathname.includes("/products/") ? product() : Response.json({ items: [branch] }));
    }),
  );
  return calls;
}

const params = (slug = "matcha-latte-nong") => ({ params: Promise.resolve({ branchCode: "Q1-LELOI", slug }) });
const clean = (text: string | null) => text?.replace(/\s+/g, " ");

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Product page — /b/[branchCode]/p/[slug] (D3a screen 3)", () => {
  it("shows the product with server prices per choice and the defaults that can be ordered", async () => {
    const calls = serve(() => Response.json(aProductDetail()));

    render(await ProductPage(params()));

    expect(calls).toContain("/api/public/v1/branches/b-q1/products/matcha-latte-nong");
    expect(screen.getByRole("heading", { level: 1, name: "Matcha latte nóng" })).toBeInTheDocument();
    expect(screen.getByText("Ấm, thơm cỏ non, hậu ngọt nhẹ.")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Matcha latte nóng trong ly gốm" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Quay lại menu" })).toHaveAttribute("href", "/b/Q1-LELOI/menu");

    const sizes = within(screen.getByRole("group", { name: "Size" }));
    expect(sizes.getAllByRole("button").map((b) => [clean(b.textContent), b.getAttribute("aria-pressed"), b.getAttribute("aria-disabled")])).toEqual([
      ["M · 55.000 ₫", "true", null],
      ["L · 65.000 ₫ · tạm hết", "false", "true"],
    ]);
    const milk = within(screen.getByRole("group", { name: "Loại sữa" }));
    expect(milk.getByRole("button", { name: "Sữa tươi" })).toHaveAttribute("aria-pressed", "true");
    expect(milk.getByRole("button", { name: /Sữa yến mạch/ })).toHaveAttribute("aria-disabled", "true");
    // No total: the choice is priced by the server when added to the cart (S4).
    expect(screen.queryByText(/Thêm vào giỏ/)).not.toBeInTheDocument();
  });

  it("keeps choices within min/max", async () => {
    serve(() => Response.json(aProductDetail()));
    const user = userEvent.setup();
    render(await ProductPage(params()));

    const extra = within(screen.getByRole("group", { name: "Thêm" }));
    await user.click(extra.getByRole("checkbox", { name: /Thêm 1 shot matcha/ }));
    await user.click(extra.getByRole("checkbox", { name: /Kem muối/ }));
    const pearl = extra.getByRole("checkbox", { name: /Trân châu/ });
    expect(pearl).toHaveAttribute("aria-disabled", "true");
    await user.click(pearl);
    expect(pearl).not.toBeChecked();
    expect(extra.getByText("Đã chọn đủ 2. Bỏ một lựa chọn để chọn món khác.")).toBeInTheDocument();

    const sweet = within(screen.getByRole("group", { name: "Độ ngọt" }));
    await user.click(sweet.getByRole("button", { name: "70%" }));
    await user.click(sweet.getByRole("button", { name: "Không đường" }));
    expect(sweet.getByRole("button", { name: "70%" })).toHaveAttribute("aria-pressed", "false");
    expect(sweet.getByRole("button", { name: "Không đường" })).toHaveAttribute("aria-pressed", "true");
  });

  it("does not pick another in place of a sold-out default, and says what is missing", async () => {
    const product = aProductDetail();
    serve(() =>
      Response.json({
        ...product,
        variants: product.variants.map((v) => (v.variantId === "v-m" ? { ...v, availability: "SOLD_OUT" } : { ...v, availability: "AVAILABLE" })),
      }),
    );
    const user = userEvent.setup();
    render(await ProductPage(params()));

    const sizes = screen.getByRole("group", { name: "Size" });
    expect(within(sizes).getAllByRole("button").map((b) => b.getAttribute("aria-pressed"))).toEqual(["false", "false"]);
    expect(sizes).toHaveAccessibleDescription("Bắt buộc · chọn 1 Còn thiếu: chọn size");
    await user.click(within(sizes).getByRole("button", { name: /^L · 65\.000/ }));
    expect(sizes).toHaveAccessibleDescription("Bắt buộc · chọn 1");
  });

  it("says when the product is sold out and offers no choices", async () => {
    serve(() => Response.json(aProductDetail({ availability: "SOLD_OUT" })));

    render(await ProductPage(params()));

    expect(screen.getByRole("status")).toHaveTextContent("Món này đang tạm hết ở chi nhánh.");
    expect(screen.queryByRole("group", { name: "Size" })).not.toBeInTheDocument();
  });

  it("answers not found for a product not on this Branch's menu (404 CATALOG_PRODUCT_NOT_FOUND)", async () => {
    serve(() => Response.json({ status: 404, code: "CATALOG_PRODUCT_NOT_FOUND" }, { status: 404 }));

    await expect(ProductPage(params("khong-co"))).rejects.toThrow("NOT_FOUND");
  });

  it("offers a retry when the product cannot be loaded", async () => {
    serve(() => Response.json({ status: 503, code: "SERVICE_UNAVAILABLE" }, { status: 503 }));

    render(await ProductPage(params()));

    expect(screen.getByRole("alert")).toHaveTextContent("Chưa tải được món.");
    expect(screen.getByRole("link", { name: "Thử lại" })).toHaveAttribute("href", "/b/Q1-LELOI/p/matcha-latte-nong");
  });
});
