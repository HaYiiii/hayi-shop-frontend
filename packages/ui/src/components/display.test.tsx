import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Button } from "./button.js";
import { EmptyState } from "./empty-state.js";
import { Skeleton, SkeletonGroup } from "./skeleton.js";
import { StatusBadge } from "./status-badge.js";
import { Table } from "./table.js";

describe("StatusBadge", () => {
  it("always carries a text label; the dot is decorative", () => {
    render(
      <StatusBadge tone="warning" dot>
        Chờ xác minh
      </StatusBadge>,
    );
    const badge = screen.getByText("Chờ xác minh");
    expect(badge).toBeVisible();
    expect(badge.closest("span")?.querySelector("[aria-hidden='true']")).not.toBeNull();
  });
});

describe("Table", () => {
  it("renders column headers with scope=col and marks the selected row", () => {
    render(
      <Table.Root aria-label="Đơn chờ xác nhận">
        <Table.Head>
          <Table.Row>
            <Table.HeaderCell>Mã đơn</Table.HeaderCell>
            <Table.HeaderCell numeric>Tổng</Table.HeaderCell>
            <Table.HeaderCell>
              <span className="sr-only">Hành động</span>
            </Table.HeaderCell>
          </Table.Row>
        </Table.Head>
        <Table.Body>
          <Table.Row selected>
            <Table.Cell>HY251012K7Q2M</Table.Cell>
            <Table.Cell numeric>117.000 ₫</Table.Cell>
            <Table.Cell>
              <Button variant="ghost" density="compact">
                Chi tiết
              </Button>
            </Table.Cell>
          </Table.Row>
        </Table.Body>
      </Table.Root>,
    );
    const table = screen.getByRole("table", { name: "Đơn chờ xác nhận" });
    const headers = within(table).getAllByRole("columnheader");
    expect(headers.map((h) => h.textContent)).toEqual(["Mã đơn", "Tổng", "Hành động"]);
    for (const header of headers) expect(header).toHaveAttribute("scope", "col");

    const row = within(table).getByRole("row", { name: /HY251012K7Q2M/ });
    expect(row).toHaveAttribute("aria-selected", "true");
  });
});

describe("Table scroll container", () => {
  it("is a focusable, labelled region so keyboard users can scroll wide tables", async () => {
    render(
      <Table.Root aria-label="Đơn chờ xác nhận">
        <Table.Body>
          <Table.Row>
            <Table.Cell>HY251012K7Q2M</Table.Cell>
          </Table.Row>
        </Table.Body>
      </Table.Root>,
    );
    const region = screen.getByRole("region", { name: "Đơn chờ xác nhận" });
    await userEvent.tab();
    expect(region).toHaveFocus();
  });
});

describe("Skeleton", () => {
  it("marks the loading region busy with a label and hides placeholder shapes", () => {
    render(
      <SkeletonGroup label="Đang tải món…">
        <Skeleton className="h-4 w-3/5" />
      </SkeletonGroup>,
    );
    const region = screen.getByLabelText("Đang tải món…");
    expect(region).toHaveAttribute("aria-busy", "true");
    expect(region.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });
});

describe("EmptyState", () => {
  it("has a heading, an explanation and one next action", () => {
    render(
      <EmptyState.Root>
        <EmptyState.Art>
          <img src="/mascot-empty.png" alt="" width={200} height={200} />
        </EmptyState.Art>
        <EmptyState.Title>Giỏ của bạn đang trống</EmptyState.Title>
        <EmptyState.Body>Chọn vài món matcha bạn thích nhé.</EmptyState.Body>
        <EmptyState.Action asChild>
          <a href="/menu">Xem menu</a>
        </EmptyState.Action>
      </EmptyState.Root>,
    );
    expect(screen.getByRole("heading", { level: 2, name: "Giỏ của bạn đang trống" })).toBeInTheDocument();
    expect(screen.getByText("Chọn vài món matcha bạn thích nhé.")).toBeVisible();
    expect(screen.getByRole("link", { name: "Xem menu" })).toHaveAttribute("href", "/menu");
  });
});
