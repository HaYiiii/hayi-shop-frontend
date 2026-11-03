import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { json, problem } from "../../../test/fake-api";
import { aBranch, branchResponse, renderAdmin } from "../test/render-admin";

const created = aBranch({ branchId: "b-new", branchCode: "Q1-NGUYENHUE", name: "HaYi Nguyễn Huệ", status: "DRAFT", activatedAt: null, version: 0 });

afterEach(() => {
  vi.unstubAllGlobals();
});

async function fillRequired(user: ReturnType<typeof renderAdmin>["user"]) {
  await user.type(await screen.findByLabelText(/Mã chi nhánh/), "q1-nguyenhue");
  await user.type(screen.getByLabelText(/Tên hiển thị/), "HaYi Nguyễn Huệ");
  await user.type(screen.getByLabelText(/Số nhà, đường/), "12 Nguyễn Huệ");
  await user.type(screen.getByLabelText(/Tỉnh \/ thành/), "TP.HCM");
}

describe("Create Branch (D3c screen 15)", () => {
  it("creates a DRAFT Branch and opens it", async () => {
    const { api, router, user } = renderAdmin("/admin/branches/new", {
      "POST /branches": () => branchResponse(created, 201),
      "GET /branches/b-new": () => branchResponse(created),
      "GET /branches": () => json({ items: [created] }),
    });

    await fillRequired(user);
    await user.type(screen.getByLabelText(/Toạ độ/), "10.7757, 106.7019");
    await user.click(screen.getByRole("button", { name: "Tạo chi nhánh" }));

    expect(await screen.findByRole("heading", { level: 1, name: "HaYi Nguyễn Huệ" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/admin/branches/b-new");
    expect(api.bodyOf("POST /branches")).toEqual({
      branchCode: "Q1-NGUYENHUE",
      name: "HaYi Nguyễn Huệ",
      address: { line: "12 Nguyễn Huệ", province: "TP.HCM" },
      location: { lat: 10.7757, lng: 106.7019 },
    });
  });

  it("shows BRANCH_CODE_TAKEN on the code field", async () => {
    const { user } = renderAdmin("/admin/branches/new", { "POST /branches": () => problem(409, "BRANCH_CODE_TAKEN") });

    await fillRequired(user);
    await user.click(screen.getByRole("button", { name: "Tạo chi nhánh" }));

    expect(await screen.findByText("Mã này đã được dùng, kể cả chi nhánh đã đóng. Bạn chọn mã khác nhé.")).toBeInTheDocument();
    expect(screen.getByLabelText(/Mã chi nhánh/)).toHaveAttribute("aria-invalid", "true");
  });

  it("shows validation errors on their fields", async () => {
    const { user } = renderAdmin("/admin/branches/new", {
      "POST /branches": () =>
        Response.json(
          { status: 400, code: "VALIDATION_FAILED", errors: [{ field: "email", code: "EMAIL", message: "Email chưa đúng định dạng" }] },
          { status: 400, headers: { "Content-Type": "application/problem+json" } },
        ),
    });

    await fillRequired(user);
    await user.click(screen.getByRole("button", { name: "Tạo chi nhánh" }));

    expect(await screen.findByText("Email chưa đúng định dạng")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
  });

  it("checks the coordinates before sending", async () => {
    const { api, user } = renderAdmin("/admin/branches/new", { "POST /branches": () => branchResponse(created, 201) });

    await fillRequired(user);
    await user.type(screen.getByLabelText(/Toạ độ/), "10.7757");
    await user.click(screen.getByRole("button", { name: "Tạo chi nhánh" }));

    expect(await screen.findByText(/Nhập vĩ độ và kinh độ/)).toBeInTheDocument();
    expect(api.calls.some((c) => c.route === "POST /branches")).toBe(false);
  });
});
