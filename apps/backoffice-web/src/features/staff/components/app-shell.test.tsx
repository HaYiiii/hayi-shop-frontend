import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { BranchSwitcher } from "../../../lib/branch-switcher";
import { type BranchDirectory, type Me, type Scope, initialScope, permissionsIn } from "../../../lib/scope";
import { AccountMenu, AppShell, Brand } from "./app-shell";
import { NavMenu } from "./nav-menu";

const manager: Me = {
  userId: "u-manager",
  email: null, displayName: "Trần Minh", mfaEnrolled: false, storeRoles: [],
  storePermissions: [],
  branches: [
    { branchId: "b-q1", roles: ["MANAGER"], permissions: ["ORDER_VIEW", "STAFF_VIEW"] },
    { branchId: "b-q3", roles: ["BARISTA"], permissions: ["ORDER_PREPARE"] },
  ],
};

const owner: Me = { userId: "u-owner", email: "owner@hayi.vn", displayName: null, mfaEnrolled: true, storeRoles: ["OWNER"], storePermissions: ["ORDER_VIEW", "STAFF_VIEW"], branches: [] };

/** Names from `GET /branches`; Võ Văn Tần is deactivated. */
const directory: BranchDirectory = new Map([
  ["b-q1", { name: "Quận 1 · Lê Lợi", status: null }],
  ["b-q3", { name: "Quận 3 · Võ Văn Tần", status: { label: "Tạm ngưng", tone: "warning" } }],
]);

/** The shell as the signed-in layout composes it. */
function Harness({ me, onLogout = () => {} }: { me: Me; onLogout?: () => void }) {
  const [scope, setScope] = useState<Scope>(() => initialScope(me, null) as Scope);
  return (
    <AppShell
      brand={<Brand />}
      scope={<BranchSwitcher me={me} branches={directory} scope={scope} onScopeChange={setScope} />}
      account={<AccountMenu name="owner@hayi.vn" onLogout={onLogout} />}
      nav={
        <NavMenu scope={scope} permissions={permissionsIn(me, scope)} renderLink={(item) => <a href={item.to}>{item.label}</a>} />
      }
    >
      <h1>Nội dung</h1>
    </AppShell>
  );
}

function menuLinks() {
  return within(screen.getByRole("navigation", { name: "Điều hướng chính" }))
    .queryAllByRole("link")
    .map((a) => a.textContent);
}

describe("AppShell — branch switcher and menu by permission (Staff Operations §16.2)", () => {
  it("changes the menu with the chosen branch", async () => {
    const user = userEvent.setup();
    render(<Harness me={manager} />);
    expect(menuLinks()).toEqual(["Bảng đơn", "Nhân sự"]);

    await user.click(screen.getByRole("button", { name: /Phạm vi: Quận 1 · Lê Lợi/ }));
    await user.click(screen.getByRole("menuitemradio", { name: /Quận 3 · Võ Văn Tần/ }));

    expect(screen.getByRole("button", { name: /Phạm vi: Quận 3 · Võ Văn Tần/ })).toBeInTheDocument();
    expect(menuLinks()).toEqual(["Màn pha chế"]);
  });

  it("describes each branch by the user's roles there", async () => {
    const user = userEvent.setup();
    render(<Harness me={manager} />);

    await user.click(screen.getByRole("button", { name: /Phạm vi/ }));

    expect(screen.getByRole("menuitemradio", { name: /Quận 3 · Võ Văn Tần.*Pha chế/ })).toBeInTheDocument();
    expect(screen.getByRole("menuitemradio", { name: /Quận 1 · Lê Lợi.*Quản lý chi nhánh/ })).toBeInTheDocument();
  });

  it("marks a Branch that is not active (D3b screen 6)", async () => {
    const user = userEvent.setup();
    render(<Harness me={manager} />);

    await user.click(screen.getByRole("button", { name: /Phạm vi/ }));

    expect(screen.getByRole("menuitemradio", { name: /Quận 3 · Võ Văn Tần/ })).toHaveTextContent("Tạm ngưng");
    expect(screen.getByRole("menuitemradio", { name: /Quận 1 · Lê Lợi/ })).not.toHaveTextContent("Tạm ngưng");
    expect(screen.queryByText(/b-q/)).not.toBeInTheDocument();
  });

  it("keeps the scope visible without a switcher when there is only one", () => {
    render(<Harness me={owner} />);

    expect(screen.getByText("Toàn hệ thống")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Phạm vi/ })).not.toBeInTheDocument();
    expect(menuLinks()).toEqual(["Nhân sự"]);
  });

  it("signs out from the account menu", async () => {
    const user = userEvent.setup();
    const onLogout = vi.fn();
    render(<Harness me={owner} onLogout={onLogout} />);

    await user.click(screen.getByRole("button", { name: /owner@hayi.vn/ }));
    await user.click(screen.getByRole("menuitem", { name: "Đăng xuất" }));

    expect(onLogout).toHaveBeenCalledOnce();
  });
});
