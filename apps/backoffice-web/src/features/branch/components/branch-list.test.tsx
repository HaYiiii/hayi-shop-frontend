import { screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { json } from "../../../test/fake-api";
import { aBranch, owner, renderAdmin } from "../test/render-admin";

const branches = [
  aBranch(),
  aBranch({ branchId: "b-q3", branchCode: "Q3-VOVANTAN", name: "Quận 3 · Võ Văn Tần", activatedAt: "2026-09-15T03:00:00Z" }),
  aBranch({ branchId: "b-td", branchCode: "TD-VOVANNGAN", name: "Thủ Đức · Võ Văn Ngân", status: "INACTIVE" }),
  aBranch({ branchId: "b-q7", branchCode: "Q7-PHUMYHUNG", name: "Quận 7 · Phú Mỹ Hưng", status: "DRAFT", activatedAt: null }),
  aBranch({ branchId: "b-bt", branchCode: "BT-XVNT", name: "Bình Thạnh · XVNT", status: "CLOSED", closedAt: "2026-10-20T03:00:00Z" }),
];

const handlers = { "GET /branches": () => json({ items: branches }) };

function rows() {
  const table = screen.getByRole("table");
  return within(table)
    .getAllByRole("row")
    .slice(1)
    .map((row) => within(row).getAllByRole("cell")[0]?.textContent);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Branch list (D3c screen 14)", () => {
  it("lists every Branch with its status, address and activation date", async () => {
    renderAdmin("/admin/branches", handlers);

    expect(await screen.findByRole("heading", { level: 1, name: "Chi nhánh" })).toBeInTheDocument();
    await screen.findByRole("table");
    expect(screen.getByText("5 chi nhánh")).toBeInTheDocument();
    expect(rows()).toEqual(["Q1-LELOI", "Q3-VOVANTAN", "TD-VOVANNGAN", "Q7-PHUMYHUNG", "BT-XVNT"]);
    const first = within(screen.getAllByRole("row")[1]!);
    expect(first.getByText("68 Lê Lợi, Bến Nghé, Quận 1, TP.HCM")).toBeInTheDocument();
    expect(first.getByText("Đang hoạt động")).toBeInTheDocument();
    expect(first.getByText("02/09/2026")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Xem Quận 1 · Lê Lợi" })).toHaveAttribute("href", "/admin/branches/b-q1");
    expect(screen.getByRole("link", { name: "Tạo chi nhánh" })).toHaveAttribute("href", "/admin/branches/new");
  });

  it("filters by status from the URL, with a count on each chip", async () => {
    const { router, user } = renderAdmin("/admin/branches?status=DRAFT", handlers);

    const filters = within(await screen.findByRole("group", { name: "Lọc theo trạng thái" }));
    expect(filters.getByRole("button", { name: "Nháp · 1" })).toHaveAttribute("aria-pressed", "true");
    expect(rows()).toEqual(["Q7-PHUMYHUNG"]);

    await user.click(filters.getByRole("button", { name: "Đang hoạt động · 2" }));
    expect(rows()).toEqual(["Q1-LELOI", "Q3-VOVANTAN"]);
    expect(router.state.location.search).toEqual({ status: "ACTIVE" });

    await user.click(filters.getByRole("button", { name: "Tất cả · 5" }));
    expect(rows()).toHaveLength(5);
    expect(router.state.location.search).toEqual({});
  });

  it("says so when a filter matches nothing", async () => {
    renderAdmin("/admin/branches?status=CLOSED", { "GET /branches": () => json({ items: [aBranch()] }) });

    expect(await screen.findByText("Không có chi nhánh nào ở trạng thái này.")).toBeInTheDocument();
  });

  it("shows the Quản trị › Chi nhánh menu entry only with BRANCH_MANAGE (UX only; the API still answers 403)", async () => {
    renderAdmin("/staff", handlers);
    const nav = within(await screen.findByRole("navigation", { name: "Điều hướng chính" }));
    expect(nav.getByRole("heading", { name: "Quản trị" })).toBeInTheDocument();
    expect(nav.getByRole("link", { name: "Chi nhánh" })).toHaveAttribute("href", "/admin/branches");
  });

  it("hides the menu entry and guards the screen without BRANCH_MANAGE", async () => {
    renderAdmin("/admin/branches", handlers, { ...owner, storeRoles: ["OWNER"], storePermissions: ["BRANCH_VIEW", "STAFF_VIEW"] });

    expect(await screen.findByText(/không có quyền xem màn này/)).toBeInTheDocument();
    const nav = within(screen.getByRole("navigation", { name: "Điều hướng chính" }));
    expect(nav.queryByRole("link", { name: "Chi nhánh" })).not.toBeInTheDocument();
  });
});
