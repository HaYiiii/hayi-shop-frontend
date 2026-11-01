import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Menu } from "./menu.js";

function ScopeMenu({ onLogout }: { onLogout: () => void }) {
  const [scope, setScope] = useState("q1");
  return (
    <>
      <Menu.Root>
        <Menu.Trigger>Chi nhánh: {scope}</Menu.Trigger>
        <Menu.Content>
          <Menu.Label>Chi nhánh bạn được giao</Menu.Label>
          <Menu.RadioGroup value={scope} onValueChange={setScope}>
            <Menu.RadioItem value="q1" description="Quản lý chi nhánh">
              Quận 1
            </Menu.RadioItem>
            <Menu.RadioItem value="q3" description="Pha chế">
              Quận 3
            </Menu.RadioItem>
          </Menu.RadioGroup>
          <Menu.Separator />
          <Menu.Item onSelect={onLogout}>Đăng xuất</Menu.Item>
        </Menu.Content>
      </Menu.Root>
    </>
  );
}

describe("Menu", () => {
  it("picks one option from a radio group with the keyboard", async () => {
    const user = userEvent.setup();
    render(<ScopeMenu onLogout={() => {}} />);

    await user.click(screen.getByRole("button", { name: "Chi nhánh: q1" }));
    expect(screen.getByRole("menuitemradio", { name: /Quận 1/ })).toHaveAttribute("aria-checked", "true");
    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");

    expect(screen.getByRole("button", { name: "Chi nhánh: q3" })).toHaveFocus();
  });

  it("runs an item's action", async () => {
    const user = userEvent.setup();
    const onLogout = vi.fn();
    render(<ScopeMenu onLogout={onLogout} />);

    await user.click(screen.getByRole("button", { name: /Chi nhánh/ }));
    await user.click(screen.getByRole("menuitem", { name: "Đăng xuất" }));

    expect(onLogout).toHaveBeenCalledOnce();
  });
});
