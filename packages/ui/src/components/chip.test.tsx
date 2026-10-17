import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Chip, ChipGroup } from "./chip.js";

function CategoryFilter() {
  const [selected, setSelected] = useState("Matcha");
  return (
    <ChipGroup aria-label="Danh mục">
      {["Matcha", "Houjicha"].map((name) => (
        <Chip key={name} pressed={selected === name} onClick={() => setSelected(name)}>
          {name}
        </Chip>
      ))}
    </ChipGroup>
  );
}

describe("Chip", () => {
  it("exposes the pressed state and updates it when chosen", async () => {
    render(<CategoryFilter />);
    const group = screen.getByRole("group", { name: "Danh mục" });
    expect(group).toBeInTheDocument();

    const houjicha = screen.getByRole("button", { name: "Houjicha" });
    expect(screen.getByRole("button", { name: "Matcha" })).toHaveAttribute("aria-pressed", "true");
    expect(houjicha).toHaveAttribute("aria-pressed", "false");

    await userEvent.click(houjicha);
    expect(houjicha).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Matcha" })).toHaveAttribute("aria-pressed", "false");
  });

  it("stays focusable but inert when unavailable, with the reason in its name", async () => {
    const onClick = vi.fn();
    render(
      <Chip pressed={false} unavailable onClick={onClick}>
        10:00 – 10:30 · Đầy
      </Chip>,
    );
    const chip = screen.getByRole("button", { name: "10:00 – 10:30 · Đầy" });
    expect(chip).toHaveAttribute("aria-disabled", "true");

    await userEvent.tab();
    expect(chip).toHaveFocus();
    await userEvent.click(chip);
    await userEvent.keyboard("{Enter}");
    expect(onClick).not.toHaveBeenCalled();
  });
});
