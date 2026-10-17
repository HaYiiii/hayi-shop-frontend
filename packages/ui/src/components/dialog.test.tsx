import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Button } from "./button.js";
import { Dialog } from "./dialog.js";
import { Sheet } from "./sheet.js";

function CancelOrderDialog() {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <Button variant="danger">Hủy đơn</Button>
      </Dialog.Trigger>
      <Dialog.Content>
        <Dialog.Title>Hủy đơn HY251012K7Q2M?</Dialog.Title>
        <Dialog.Description>Khách đã thanh toán 117.000 ₫.</Dialog.Description>
        <Dialog.Actions>
          <Dialog.Close asChild>
            <Button variant="outline">Giữ đơn</Button>
          </Dialog.Close>
          <Button variant="danger">Xác nhận hủy</Button>
        </Dialog.Actions>
      </Dialog.Content>
    </Dialog.Root>
  );
}

function PickupSheet() {
  return (
    <Sheet.Root>
      <Sheet.Trigger asChild>
        <Button>Đổi giờ nhận</Button>
      </Sheet.Trigger>
      <Sheet.Content>
        <Sheet.Title>Chọn giờ nhận</Sheet.Title>
        <Sheet.Description>Giờ theo chi nhánh.</Sheet.Description>
        <Button block density="touch">
          Lưu giờ nhận
        </Button>
      </Sheet.Content>
    </Sheet.Root>
  );
}

describe.each([
  { name: "Dialog", ui: <CancelOrderDialog />, trigger: "Hủy đơn", title: "Hủy đơn HY251012K7Q2M?" },
  { name: "Sheet", ui: <PickupSheet />, trigger: "Đổi giờ nhận", title: "Chọn giờ nhận" },
])("$name", ({ ui, trigger, title }) => {
  it("opens a modal dialog named by its title and described by its body", async () => {
    render(ui);
    await userEvent.click(screen.getByRole("button", { name: trigger }));

    const dialog = screen.getByRole("dialog", { name: title });
    expect(dialog).toHaveAccessibleDescription();
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it("keeps focus inside while tabbing", async () => {
    render(ui);
    await userEvent.click(screen.getByRole("button", { name: trigger }));
    const dialog = screen.getByRole("dialog", { name: title });

    for (let i = 0; i < 5; i++) {
      await userEvent.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    render(ui);
    const opener = screen.getByRole("button", { name: trigger });
    await userEvent.click(opener);

    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(opener).toHaveFocus();
  });
});

describe("Dialog close button", () => {
  it("closes from a Dialog.Close action", async () => {
    render(<CancelOrderDialog />);
    await userEvent.click(screen.getByRole("button", { name: "Hủy đơn" }));
    await userEvent.click(screen.getByRole("button", { name: "Giữ đơn" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
