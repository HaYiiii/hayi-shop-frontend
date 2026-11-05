import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import MenuPage from "./page";

vi.mock("next/server", () => ({ connection: () => Promise.resolve() }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));

function serve(answer: () => Response) {
  vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(answer())));
}

const params = (branchCode: string) => ({ params: Promise.resolve({ branchCode }) });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Menu placeholder — /b/[branchCode]/menu", () => {
  it("retries the same menu page when the Branch list fails", async () => {
    serve(() => Response.json({ status: 503, code: "SERVICE_UNAVAILABLE" }, { status: 503 }));

    render(await MenuPage(params("Q1-LELOI")));

    expect(screen.getByRole("alert")).toHaveTextContent("Chưa tải được danh sách chi nhánh.");
    expect(screen.getByRole("link", { name: "Thử lại" })).toHaveAttribute("href", "/b/Q1-LELOI/menu");
  });

  it("answers a malformed code with not found, not a server error", async () => {
    serve(() => Response.json({ items: [{ branchId: "b1", branchCode: "Q1-LELOI", name: "Quận 1 · Lê Lợi" }] }));

    await expect(MenuPage(params("%E0%A4%A"))).rejects.toThrow("NOT_FOUND");
  });
});
