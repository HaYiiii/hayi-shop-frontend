import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { BranchSwitcher } from "../../../lib/branch-switcher";
import { type Me, type Scope, initialScope, permissionsIn } from "../../../lib/scope";
import { AccountMenu, AppShell, Brand } from "./app-shell";
import { NavMenu } from "./nav-menu";

const manager: Me = {
  userId: "u-manager",
  storeRoles: [],
  storePermissions: [],
  branches: [
    { branchId: "b-q1", roles: ["MANAGER"], permissions: ["ORDER_VIEW", "STAFF_VIEW"] },
    { branchId: "b-q3", roles: ["BARISTA"], permissions: ["ORDER_PREPARE"] },
  ],
};

const owner: Me = { userId: "u-owner", storeRoles: ["OWNER"], storePermissions: ["ORDER_VIEW", "STAFF_VIEW"], branches: [] };

/** The shell as the signed-in layout composes it. */
function Harness({ me, onLogout = () => {} }: { me: Me; onLogout?: () => void }) {
  const [scope, setScope] = useState<Scope>(() => initialScope(me, null) as Scope);
  return (
    <AppShell
      brand={<Brand />}
      scope={<BranchSwitcher me={me} scope={scope} onScopeChange={setScope} />}
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

    await user.click(screen.getByRole("button", { name: /Phạm vi: Chi nhánh b-q1/ }));
    await user.click(screen.getByRole("menuitemradio", { name: /b-q3/ }));

    expect(screen.getByRole("button", { name: /Phạm vi: Chi nhánh b-q3/ })).toBeInTheDocument();
    expect(menuLinks()).toEqual(["Màn pha chế"]);
  });

  it("describes each branch by the user's roles there", async () => {
    const user = userEvent.setup();
    render(<Harness me={manager} />);

    await user.click(screen.getByRole("button", { name: /Phạm vi/ }));

    expect(screen.getByRole("menuitemradio", { name: /b-q3.*Pha chế/ })).toBeInTheDocument();
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
