import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Scope } from "../../../lib/scope";
import { NavMenu } from "./nav-menu";

const branch: Scope = { kind: "branch", branchId: "b-q1" };

function renderMenu(scope: Scope, permissions: string[]) {
  render(<NavMenu scope={scope} permissions={new Set(permissions)} renderLink={(item) => <a href={item.to}>{item.label}</a>} />);
}

function links() {
  return screen.queryAllByRole("link").map((a) => a.textContent);
}

describe("NavMenu — shows only what the scope permits (UX guard; the API still answers 403)", () => {
  it("shows a Barista only the preparation screen", () => {
    renderMenu(branch, ["ORDER_PREPARE"]);

    expect(links()).toEqual(["Màn pha chế"]);
    expect(screen.queryByText("Quản lý chi nhánh")).not.toBeInTheDocument();
  });

  it("shows a Manager the operations and branch-management groups", () => {
    renderMenu(branch, ["ORDER_VIEW", "ORDER_PREPARE", "PAYMENT_VERIFY", "SOLD_OUT_MANAGE", "FULFILLMENT_CONFIG_MANAGE", "STAFF_VIEW"]);

    expect(links()).toEqual(["Bảng đơn", "Màn pha chế", "Duyệt thanh toán", "Hết hàng", "Cấu hình khung giờ", "Nhân sự"]);
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual(["Vận hành", "Quản lý chi nhánh"]);
  });

  it("shows only store-level screens in the store-wide scope (Branch screens need a Branch)", () => {
    renderMenu({ kind: "store" }, ["ORDER_VIEW", "STAFF_VIEW"]);

    expect(links()).toEqual(["Nhân sự"]);
  });

  it("says so when nothing is permitted", () => {
    renderMenu(branch, []);

    expect(links()).toEqual([]);
    expect(screen.getByText(/chưa có quyền/i)).toBeInTheDocument();
  });
});
