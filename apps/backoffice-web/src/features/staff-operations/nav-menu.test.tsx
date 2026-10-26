import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NavMenu } from "./nav-menu";

function links() {
  return screen.queryAllByRole("link").map((a) => a.textContent);
}

describe("NavMenu — shows only what the scope permits (UX guard; the API still answers 403)", () => {
  it("shows a Barista only the preparation screen", () => {
    render(<NavMenu permissions={new Set(["ORDER_PREPARE"])} renderLink={(item) => <a href={item.path}>{item.label}</a>} />);

    expect(links()).toEqual(["Màn pha chế"]);
    expect(screen.queryByText("Quản lý chi nhánh")).not.toBeInTheDocument();
  });

  it("shows a Manager the operations and branch-management groups", () => {
    render(
      <NavMenu
        permissions={new Set(["ORDER_VIEW", "ORDER_PREPARE", "PAYMENT_VERIFY", "SOLD_OUT_MANAGE", "FULFILLMENT_CONFIG_MANAGE", "STAFF_VIEW"])}
        renderLink={(item) => <a href={item.path}>{item.label}</a>}
      />,
    );

    expect(links()).toEqual(["Bảng đơn", "Màn pha chế", "Duyệt thanh toán", "Hết hàng", "Cấu hình khung giờ", "Nhân sự"]);
    expect(screen.getByRole("navigation", { name: "Điều hướng chính" })).toBeInTheDocument();
  });

  it("says so when nothing is permitted", () => {
    render(<NavMenu permissions={new Set()} renderLink={(item) => <a href={item.path}>{item.label}</a>} />);

    expect(links()).toEqual([]);
    expect(screen.getByText(/chưa có quyền/i)).toBeInTheDocument();
  });
});
