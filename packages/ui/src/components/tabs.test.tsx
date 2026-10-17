import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Tabs } from "./tabs.js";

function StatusTabs() {
  return (
    <Tabs.Root defaultValue="PENDING">
      <Tabs.List aria-label="Trạng thái đơn">
        <Tabs.Tab value="PENDING">
          Chờ xác nhận <Tabs.Count>4</Tabs.Count>
        </Tabs.Tab>
        <Tabs.Tab value="PREPARING">Đang pha chế</Tabs.Tab>
        <Tabs.Tab value="READY">Sẵn sàng</Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="PENDING">Đơn chờ xác nhận</Tabs.Panel>
      <Tabs.Panel value="PREPARING">Đơn đang pha chế</Tabs.Panel>
      <Tabs.Panel value="READY">Đơn sẵn sàng</Tabs.Panel>
    </Tabs.Root>
  );
}

describe("Tabs", () => {
  it("exposes a labelled tablist with the selected tab and its panel", () => {
    render(<StatusTabs />);
    expect(screen.getByRole("tablist", { name: "Trạng thái đơn" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Chờ xác nhận 4" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel", { name: "Chờ xác nhận 4" })).toHaveTextContent("Đơn chờ xác nhận");
  });

  it("moves between tabs with the arrow keys", async () => {
    render(<StatusTabs />);
    await userEvent.tab();
    expect(screen.getByRole("tab", { name: "Chờ xác nhận 4" })).toHaveFocus();

    await userEvent.keyboard("{ArrowRight}");
    const preparing = screen.getByRole("tab", { name: "Đang pha chế" });
    expect(preparing).toHaveFocus();
    expect(preparing).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Đơn đang pha chế");
  });
});
