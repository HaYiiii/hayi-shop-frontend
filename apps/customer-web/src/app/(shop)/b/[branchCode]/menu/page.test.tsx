import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { aMenu } from "../../../../../features/menu/test/menu";
import MenuPage from "./page";

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

/** Answers by path: the Branch list, then the menu. */
function serve(menu: () => Response, branches: () => Response = () => Response.json({ items: [branch] })) {
  const calls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((input: Request | string) => {
      const url = new URL(typeof input === "string" ? input : input.url);
      calls.push(url.pathname);
      return Promise.resolve(url.pathname.endsWith("/menu") ? menu() : branches());
    }),
  );
  return calls;
}

const params = (branchCode: string) => ({ params: Promise.resolve({ branchCode }) });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Menu — /b/[branchCode]/menu (D3a screen 2)", () => {
  it("shows the Branch's menu by Category, with a bar that jumps to each Category", async () => {
    const calls = serve(() => Response.json(aMenu()));

    render(await MenuPage(params("Q1-LELOI")));

    expect(calls).toContain("/api/public/v1/branches/b-q1/menu");
    expect(screen.getByRole("heading", { level: 1, name: "Menu Quận 1 · Lê Lợi" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Lấy tại Quận 1 · Lê Lợi. Đổi chi nhánh" })).toHaveAttribute("href", "/");
    const bar = within(screen.getByRole("navigation", { name: "Danh mục" }));
    expect(bar.getAllByRole("link").map((a) => [a.textContent, a.getAttribute("href")])).toEqual([
      ["Matcha", "#c-matcha"],
      ["Bánh", "#c-banh"],
    ]);
    expect(screen.getByRole("heading", { level: 2, name: "Matcha" })).toHaveAttribute("id", "c-matcha");
    expect(screen.getByRole("heading", { level: 3, name: "Matcha latte" })).toBeInTheDocument();

    const latte = within(screen.getByRole("link", { name: /^Matcha latte đá/ }));
    expect(latte.getByText("Từ 45.000 ₫", { normalizer: (t) => t.replace(/\s+/g, " ") })).toBeInTheDocument();
    expect(latte.queryByText("Hết món")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Matcha latte đá/ })).toHaveAttribute("href", "/b/Q1-LELOI/p/matcha-latte");
  });

  it("marks products that cannot be ordered now", async () => {
    serve(() => Response.json(aMenu()));

    render(await MenuPage(params("Q1-LELOI")));

    expect(within(screen.getByRole("link", { name: /^Matcha đá xay/ })).getByText("Hết món")).toBeInTheDocument();
    expect(within(screen.getByRole("link", { name: /^Bánh bông lan matcha/ })).getByText("Tạm ngưng")).toBeInTheDocument();
  });

  it("says so when the Branch has nothing on sale", async () => {
    serve(() => Response.json(aMenu({ categories: [] })));

    render(await MenuPage(params("Q1-LELOI")));

    expect(screen.getByText(/Chi nhánh chưa có món nào đang bán/)).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Danh mục" })).not.toBeInTheDocument();
  });

  it("answers not found when the Branch closed meanwhile (404 BRANCH_NOT_FOUND)", async () => {
    serve(() => Response.json({ status: 404, code: "BRANCH_NOT_FOUND" }, { status: 404 }));

    await expect(MenuPage(params("Q1-LELOI"))).rejects.toThrow("NOT_FOUND");
  });

  it("offers a retry when the menu cannot be loaded", async () => {
    serve(() => Response.json({ status: 503, code: "SERVICE_UNAVAILABLE" }, { status: 503 }));

    render(await MenuPage(params("Q1-LELOI")));

    expect(screen.getByRole("alert")).toHaveTextContent("Chưa tải được menu.");
    expect(screen.getByRole("link", { name: "Thử lại" })).toHaveAttribute("href", "/b/Q1-LELOI/menu");
    expect(screen.getByRole("link", { name: "Chọn chi nhánh khác" })).toHaveAttribute("href", "/");
  });

  it("retries the same menu page when the Branch list fails", async () => {
    serve(
      () => Response.json(aMenu()),
      () => Response.json({ status: 503, code: "SERVICE_UNAVAILABLE" }, { status: 503 }),
    );

    render(await MenuPage(params("Q1-LELOI")));

    expect(screen.getByRole("alert")).toHaveTextContent("Chưa tải được danh sách chi nhánh.");
    expect(screen.getByRole("link", { name: "Thử lại" })).toHaveAttribute("href", "/b/Q1-LELOI/menu");
  });

  it("answers an unknown or malformed code with not found, not a server error", async () => {
    serve(() => Response.json(aMenu()));

    await expect(MenuPage(params("Q9-KHONG"))).rejects.toThrow("NOT_FOUND");
    await expect(MenuPage(params("%E0%A4%A"))).rejects.toThrow("NOT_FOUND");
  });
});

describe("Menu — outside selling hours (D3a screen 2b, FE #54)", () => {
  it("dims the product and names the time it is not sold at, in Branch time", async () => {
    const menu = aMenu();
    menu.categories[1]!.products[0] = { ...menu.categories[1]!.products[0]!, availability: "OUTSIDE_SELLING_HOURS" };
    serve(() => Response.json(menu));

    render(await MenuPage(params("Q1-LELOI")));

    // evaluatedAt 2026-11-19T03:00:00Z = 10:00 in Asia/Ho_Chi_Minh.
    expect(within(screen.getByRole("link", { name: /^Bánh bông lan matcha/ })).getByText("Không bán lúc 10:00")).toBeInTheDocument();
  });
});
