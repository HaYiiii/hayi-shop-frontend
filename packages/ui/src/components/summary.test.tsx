import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Summary } from "./summary.js";

describe("Summary", () => {
  it("marks the current lifecycle step and hides the arrows from screen readers", () => {
    render(
      <Summary.Root aria-label="Tóm tắt">
        <Summary.Steps
          label="Vòng đời"
          steps={[
            { key: "DRAFT", label: "Nháp" },
            { key: "ACTIVE", label: "Đang hoạt động", connector: "⇄" },
            { key: "INACTIVE", label: "Tạm ngưng" },
            { key: "CLOSED", label: "Đã đóng" },
          ]}
          current="ACTIVE"
        />
        <Summary.Item>Kích hoạt 02/09/2026</Summary.Item>
      </Summary.Root>,
    );
    const steps = screen.getByRole("list", { name: "Vòng đời" });
    expect(screen.getByText("Đang hoạt động")).toHaveAttribute("aria-current", "step");
    expect(screen.getByText("Nháp")).not.toHaveAttribute("aria-current");
    expect(steps).toHaveTextContent("Nháp→Đang hoạt động⇄Tạm ngưng→Đã đóng");
    for (const arrow of steps.querySelectorAll("[data-slot='summary-connector']")) {
      expect(arrow).toHaveAttribute("aria-hidden", "true");
    }
    expect(screen.getByText("Kích hoạt 02/09/2026")).toBeInTheDocument();
  });
});
