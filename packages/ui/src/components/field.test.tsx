import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Field } from "./field.js";

describe("Field", () => {
  it("connects the visible label to the input", () => {
    render(
      <Field.Root>
        <Field.Label>Tên người nhận</Field.Label>
        <Field.Input name="recipientName" autoComplete="name" />
      </Field.Root>,
    );
    expect(screen.getByLabelText("Tên người nhận")).toHaveAttribute("name", "recipientName");
  });

  it("describes the input with its hint", () => {
    render(
      <Field.Root>
        <Field.Label>Tên người nhận</Field.Label>
        <Field.Input />
        <Field.Hint>Tên gọi khi đơn sẵn sàng</Field.Hint>
      </Field.Root>,
    );
    const input = screen.getByLabelText("Tên người nhận");
    expect(input).toHaveAccessibleDescription("Tên gọi khi đơn sẵn sàng");
    expect(input).not.toHaveAttribute("aria-invalid");
  });

  it("marks the input invalid and describes it with the error message", () => {
    render(
      <Field.Root>
        <Field.Label>Số điện thoại</Field.Label>
        <Field.Input type="tel" inputMode="tel" autoComplete="tel" />
        <Field.Hint>Dùng để báo khi đơn sẵn sàng</Field.Hint>
        <Field.Error>Số điện thoại cần 10 chữ số, ví dụ 0901234567.</Field.Error>
      </Field.Root>,
    );
    const input = screen.getByLabelText("Số điện thoại");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription(
      "Dùng để báo khi đơn sẵn sàng Số điện thoại cần 10 chữ số, ví dụ 0901234567.",
    );
  });

  it("drops the invalid state when the error is removed", () => {
    const { rerender } = render(
      <Field.Root>
        <Field.Label>Số điện thoại</Field.Label>
        <Field.Input />
        <Field.Error>Số điện thoại cần 10 chữ số.</Field.Error>
      </Field.Root>,
    );
    rerender(
      <Field.Root>
        <Field.Label>Số điện thoại</Field.Label>
        <Field.Input />
      </Field.Root>,
    );
    const input = screen.getByLabelText("Số điện thoại");
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(input).not.toHaveAttribute("aria-describedby");
  });

  it("labels a native select the same way", () => {
    render(
      <Field.Root>
        <Field.Label>Chi nhánh</Field.Label>
        <Field.Select name="branchId">
          <option>HaYi Nguyễn Huệ</option>
          <option>HaYi Thảo Điền</option>
        </Field.Select>
      </Field.Root>,
    );
    expect(screen.getByRole("combobox", { name: "Chi nhánh" })).toHaveAttribute("name", "branchId");
  });
});
