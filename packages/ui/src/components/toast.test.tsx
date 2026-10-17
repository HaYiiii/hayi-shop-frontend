import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ToastProvider, useToast } from "./toast.js";

function AddToCart({ onViewCart = () => {} }: { onViewCart?: () => void }) {
  const toast = useToast();
  return (
    <button
      type="button"
      onClick={() =>
        toast({
          title: "Đã thêm vào giỏ",
          description: "Matcha Latte · L",
          action: { label: "Xem giỏ", altText: "Mở giỏ hàng", onClick: onViewCart },
        })
      }
    >
      Thêm vào giỏ
    </button>
  );
}

describe("Toast", () => {
  it("announces politely in a status region with title and description", async () => {
    render(
      <ToastProvider>
        <AddToCart />
      </ToastProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Thêm vào giỏ" }));

    expect(screen.getByText("Đã thêm vào giỏ")).toBeVisible();
    expect(screen.getByRole("region", { name: "Thông báo (F8)" })).toBeInTheDocument();

    const announcer = screen.getByRole("status");
    expect(announcer).toHaveAttribute("aria-live", "polite");
    await waitFor(() => expect(announcer).toHaveTextContent(/Đã thêm vào giỏ\s*Matcha Latte · L/));
    expect(document.querySelector("[aria-live='assertive']")).toBeNull();
  });

  it("offers at most one action", async () => {
    const onViewCart = vi.fn();
    render(
      <ToastProvider>
        <AddToCart onViewCart={onViewCart} />
      </ToastProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Thêm vào giỏ" }));
    await userEvent.click(screen.getByRole("button", { name: "Xem giỏ" }));
    expect(onViewCart).toHaveBeenCalledTimes(1);
  });

  it("hides itself after 5 seconds", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      render(
        <ToastProvider>
          <AddToCart />
        </ToastProvider>,
      );
      await userEvent.click(screen.getByRole("button", { name: "Thêm vào giỏ" }));
      expect(screen.getByText("Đã thêm vào giỏ")).toBeInTheDocument();

      act(() => vi.advanceTimersByTime(5100));
      expect(screen.queryByText("Đã thêm vào giỏ")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
