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

  it("marks the input invalid and lets the error replace the hint", () => {
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
    expect(input).toHaveAccessibleDescription("Số điện thoại cần 10 chữ số, ví dụ 0901234567.");
    expect(screen.queryByText("Dùng để báo khi đơn sẵn sàng")).not.toBeVisible();
  });

  it("shows the hint again once the error is fixed", () => {
    const field = (error?: string) => (
      <Field.Root>
        <Field.Label>Số điện thoại</Field.Label>
        <Field.Input />
        <Field.Hint>Dùng để báo khi đơn sẵn sàng</Field.Hint>
        {error ? <Field.Error>{error}</Field.Error> : null}
      </Field.Root>
    );
    const { rerender } = render(field("Số điện thoại cần 10 chữ số."));
    rerender(field());
    expect(screen.getByText("Dùng để báo khi đơn sẵn sàng")).toBeVisible();
    expect(screen.getByLabelText("Số điện thoại")).toHaveAccessibleDescription("Dùng để báo khi đơn sẵn sàng");
  });

  it("keeps a control with its unit in the control slot", () => {
    render(
      <Field.Root>
        <Field.Label>Cho đặt trước tối đa</Field.Label>
        <Field.Control>
          <Field.Input type="number" />
          <span>ngày</span>
        </Field.Control>
        <Field.Hint>Tính từ hôm nay</Field.Hint>
      </Field.Root>,
    );
    const input = screen.getByLabelText("Cho đặt trước tối đa");
    expect(input).toHaveAccessibleDescription("Tính từ hôm nay");
    expect(input.closest("[data-slot='field-control']")).toHaveTextContent("ngày");
  });

  it("labels a read-only value without a control", () => {
    render(
      <Field.Group>
        <Field.Root>
          <Field.Label asChild>
            <span>Mã chi nhánh</span>
          </Field.Label>
          <span>Q1-LELOI</span>
          <Field.Hint>Không đổi được sau khi tạo.</Field.Hint>
        </Field.Root>
      </Field.Group>,
    );
    const label = screen.getByText("Mã chi nhánh");
    expect(label.tagName).toBe("SPAN");
    expect(label).toHaveAttribute("data-slot", "field-label");
    expect(label).not.toHaveAttribute("for");
    expect(screen.getByText("Không đổi được sau khi tạo.")).toHaveAttribute("data-slot", "field-message");
  });

  it("names a group of fields rendered as a fieldset", () => {
    render(
      <Field.Group asChild>
        <fieldset>
          <legend>Liên hệ</legend>
          <Field.Root>
            <Field.Label>Email</Field.Label>
            <Field.Input type="email" />
          </Field.Root>
          <Field.Root span="full">
            <Field.Label>Ghi chú</Field.Label>
            <Field.Input />
          </Field.Root>
        </fieldset>
      </Field.Group>,
    );
    const group = screen.getByRole("group", { name: "Liên hệ" });
    expect(group).toHaveAttribute("data-slot", "field-group");
    expect(screen.getByLabelText("Ghi chú").closest("[data-slot='field']")).toHaveAttribute("data-span", "full");
  });

  it("lays a group out horizontally with a set label width", () => {
    render(
      <Field.Group orientation="horizontal" labelWidth="240px" data-testid="rules">
        <Field.Root>
          <Field.Label>Độ dài mỗi khung</Field.Label>
          <Field.Input />
        </Field.Root>
      </Field.Group>,
    );
    const group = screen.getByTestId("rules");
    expect(group).toHaveAttribute("data-orientation", "horizontal");
    expect(group.style.getPropertyValue("--hy-label-w")).toBe("240px");
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

  it("keeps a caller's aria-describedby alongside the error", () => {
    render(
      <>
        <p id="phone-policy">Chỉ dùng để báo đơn.</p>
        <Field.Root>
          <Field.Label>Số điện thoại</Field.Label>
          <Field.Input aria-describedby="phone-policy" />
          <Field.Hint>Ví dụ 0901234567</Field.Hint>
          <Field.Error>Số điện thoại cần 10 chữ số.</Field.Error>
        </Field.Root>
      </>,
    );
    expect(screen.getByLabelText("Số điện thoại")).toHaveAccessibleDescription(
      "Chỉ dùng để báo đơn. Số điện thoại cần 10 chữ số.",
    );
  });

  it("keeps a caller's aria-invalid when no error message is rendered", () => {
    render(
      <Field.Root>
        <Field.Label>Mã giảm giá</Field.Label>
        <Field.Input aria-invalid />
      </Field.Root>,
    );
    expect(screen.getByLabelText("Mã giảm giá")).toHaveAttribute("aria-invalid", "true");
  });

  it("owns the control's id (type-level interface)", () => {
    render(
      <Field.Root>
        <Field.Label>Tên người nhận</Field.Label>
        {/* @ts-expect-error id links the label and is owned by Field */}
        <Field.Input id="custom" />
      </Field.Root>,
    );
    expect(screen.getByLabelText("Tên người nhận")).toBeInTheDocument();
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

  it("labels and describes a textarea the same way", () => {
    render(
      <Field.Root>
        <Field.Label>Mô tả</Field.Label>
        <Field.Textarea name="description" rows={3} />
        <Field.Hint>Tối đa 500 ký tự.</Field.Hint>
        <Field.Error>Mô tả dài quá 500 ký tự.</Field.Error>
      </Field.Root>,
    );
    const textarea = screen.getByRole("textbox", { name: "Mô tả" });
    expect(textarea.tagName).toBe("TEXTAREA");
    expect(textarea).toHaveAttribute("aria-invalid", "true");
    expect(textarea).toHaveAccessibleDescription("Mô tả dài quá 500 ký tự.");
  });
});
