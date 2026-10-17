import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./button.js";

describe("Button", () => {
  it("is reachable by keyboard and activates by its accessible name", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Xác nhận đơn</Button>);

    await userEvent.tab();
    const button = screen.getByRole("button", { name: "Xác nhận đơn" });
    expect(button).toHaveFocus();

    await userEvent.keyboard("{Enter}");
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("announces busy state, hides the spinner from assistive tech and ignores repeat clicks", async () => {
    const onClick = vi.fn();
    render(
      <Button busy onClick={onClick}>
        Đang xác nhận…
      </Button>,
    );

    const button = screen.getByRole("button", { name: "Đang xác nhận…" });
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button.querySelector("[aria-hidden='true']")).not.toBeNull();

    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("does not activate when disabled", async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Chưa đủ điều kiện
      </Button>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Chưa đủ điều kiện" }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("defaults to type=button so it never submits a form by accident", () => {
    render(<Button>Thêm ghi chú</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "button");
  });

  it("renders its child element when asChild is set, keeping the button styling", () => {
    render(
      <Button asChild>
        <a href="/menu">Xem menu</a>
      </Button>,
    );
    const link = screen.getByRole("link", { name: "Xem menu" });
    expect(link).toHaveAttribute("href", "/menu");
    expect(screen.queryByRole("button")).toBeNull();
  });
});
