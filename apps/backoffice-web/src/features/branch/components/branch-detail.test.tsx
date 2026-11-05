import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { json, noContent, problem } from "../../../test/fake-api";
import type { Branch, BranchConflict, BranchStatus } from "../branch-form";
import { aBranch, branchResponse, renderAdmin } from "../test/render-admin";

const conflicts: BranchConflict[] = [
  { type: "ACTIVE_ORDERS", count: 4 },
  { type: "FUTURE_SCHEDULED_ORDERS", count: 9 },
  { type: "OPEN_GROUP_SESSIONS", count: 1 },
];

function openCommitments() {
  return Response.json(
    { status: 409, code: "BRANCH_HAS_OPEN_COMMITMENTS", conflicts },
    { status: 409, headers: { "Content-Type": "application/problem+json" } },
  );
}

/** A Branch the fake server keeps, so reloads see edits and transitions. */
function server(initial: Partial<Branch> = {}) {
  let branch = aBranch(initial);
  const set = (next: Partial<Branch>) => {
    branch = { ...branch, ...next, version: branch.version + 1 };
    return branchResponse(branch);
  };
  return {
    get branch() {
      return branch;
    },
    set,
    handlers: {
      "GET /branches/b-q1": () => branchResponse(branch),
      "GET /branches": () => json({ items: [branch] }),
      "GET /branches/b-q1/closure-check": () => json({ conflicts: [] }),
    },
  };
}

function headerOf(api: ReturnType<typeof renderAdmin>["api"], route: string, name: string) {
  const call = api.calls.findLast((c) => c.route === route);
  return call?.headers.get(name);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Branch information (D3c screen 16)", () => {
  it("shows the Branch with its code, status and lifecycle facts", async () => {
    const s = server();
    renderAdmin("/admin/branches/b-q1", s.handlers);

    expect(await screen.findByRole("heading", { level: 1, name: "Quận 1 · Lê Lợi" })).toBeInTheDocument();
    const header = within(screen.getByRole("region", { name: "Tóm tắt chi nhánh" }));
    expect(header.getByText("Q1-LELOI")).toBeInTheDocument();
    expect(header.getByText("Đang hoạt động")).toBeInTheDocument();
    // Lifecycle facts sit in the page summary under the title, not in a side column (D2 "Bố cục trang").
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    const summary = within(screen.getByRole("group", { name: "Vòng đời và mốc thời gian" }));
    expect(summary.getByRole("list", { name: "Vòng đời" })).toBeInTheDocument();
    expect(summary.getByText("Đang hoạt động")).toHaveAttribute("aria-current", "step");
    expect(summary.getByText("Kích hoạt 02/09/2026")).toBeInTheDocument();
    expect(summary.getByText("Tạo 28/08/2026")).toBeInTheDocument();
    expect(screen.getByLabelText(/Tên hiển thị/)).toHaveValue("Quận 1 · Lê Lợi");
    expect(screen.getByRole("navigation", { name: "Phần chi nhánh" })).toBeInTheDocument();
  });

  it("saves only the changed fields as a merge patch with If-Match", async () => {
    const s = server();
    const { api, user } = renderAdmin("/admin/branches/b-q1", {
      ...s.handlers,
      "PATCH /branches/b-q1": (body) => s.set({ name: (body as { name: string }).name, email: null }),
    });

    const name = await screen.findByLabelText(/Tên hiển thị/);
    await user.clear(name);
    await user.type(name, "Quận 1 · Lê Lợi 2");
    await user.clear(screen.getByLabelText("Email"));
    await user.click(screen.getByRole("button", { name: "Lưu thông tin" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Đã lưu thông tin chi nhánh.");
    expect(api.bodyOf("PATCH /branches/b-q1")).toEqual({ name: "Quận 1 · Lê Lợi 2", email: null });
    expect(headerOf(api, "PATCH /branches/b-q1", "If-Match")).toBe('"v3"');
    expect(headerOf(api, "PATCH /branches/b-q1", "Content-Type")).toBe("application/merge-patch+json");
    expect(screen.getByRole("heading", { level: 1, name: "Quận 1 · Lê Lợi 2" })).toBeInTheDocument();
  });

  it("on 412 VERSION_CONFLICT says the data changed and reloads the newer version", async () => {
    const s = server();
    const { user } = renderAdmin("/admin/branches/b-q1", { ...s.handlers, "PATCH /branches/b-q1": () => problem(412, "VERSION_CONFLICT") });

    const name = await screen.findByLabelText(/Tên hiển thị/);
    await user.type(name, " mới");
    s.set({ name: "Tên do người khác sửa" });
    await user.click(screen.getByRole("button", { name: "Lưu thông tin" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("vừa được người khác cập nhật");
    await user.click(screen.getByRole("button", { name: "Tải lại" }));

    await waitFor(() => expect(screen.getByLabelText(/Tên hiển thị/)).toHaveValue("Tên do người khác sửa"));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("clears the server's field errors on Bỏ thay đổi and on a submit stopped on the client", async () => {
    const s = server();
    const { user } = renderAdmin("/admin/branches/b-q1", {
      ...s.handlers,
      "PATCH /branches/b-q1": () =>
        Response.json(
          { status: 400, code: "VALIDATION_FAILED", errors: [{ field: "email", code: "EMAIL", message: "Email chưa đúng định dạng" }] },
          { status: 400, headers: { "Content-Type": "application/problem+json" } },
        ),
    });

    const email = await screen.findByLabelText("Email");
    await user.type(email, "x");
    await user.click(screen.getByRole("button", { name: "Lưu thông tin" }));
    expect(await screen.findByText("Email chưa đúng định dạng")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Bỏ thay đổi" }));
    expect(screen.queryByText("Email chưa đúng định dạng")).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("Email"), "x");
    await user.click(screen.getByRole("button", { name: "Lưu thông tin" }));
    expect(await screen.findByText("Email chưa đúng định dạng")).toBeInTheDocument();
    await user.type(screen.getByLabelText(/Toạ độ/), "abc");
    await user.click(screen.getByRole("button", { name: "Lưu thông tin" }));

    expect(await screen.findByText(/Nhập vĩ độ và kinh độ/)).toBeInTheDocument();
    expect(screen.queryByText("Email chưa đúng định dạng")).not.toBeInTheDocument();
  });

  it("does not send anything when nothing changed", async () => {
    const s = server();
    const { api, user } = renderAdmin("/admin/branches/b-q1", s.handlers);

    await user.click(await screen.findByRole("button", { name: "Lưu thông tin" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Không có thay đổi nào để lưu.");
    expect(api.calls.some((c) => c.route === "PATCH /branches/b-q1")).toBe(false);
  });

  it("links a DRAFT Branch to its pickup slots, to set them up before activating", async () => {
    const s = server({ status: "DRAFT", activatedAt: null });
    renderAdmin("/admin/branches/b-q1", s.handlers);

    const tabs = within(await screen.findByRole("navigation", { name: "Phần chi nhánh" }));
    expect(tabs.getByRole("link", { name: "Khung giờ nhận đơn" })).toHaveAttribute("href", "/branches/b-q1/slots");
  });

  it("does not send a CLOSED Branch to its operational screens (they would switch the working scope)", async () => {
    const s = server({ status: "CLOSED", closedAt: "2026-10-20T03:00:00Z" });
    renderAdmin("/admin/branches/b-q1", s.handlers);

    const tabs = within(await screen.findByRole("navigation", { name: "Phần chi nhánh" }));
    expect(tabs.queryByRole("link", { name: "Khung giờ nhận đơn" })).not.toBeInTheDocument();
  });

  it("locks the form of a CLOSED Branch", async () => {
    const s = server({ status: "CLOSED", closedAt: "2026-10-20T03:00:00Z" });
    renderAdmin("/admin/branches/b-q1", s.handlers);

    expect(await screen.findByLabelText(/Tên hiển thị/)).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Lưu thông tin" })).not.toBeInTheDocument();
    expect(screen.getByText(/Chi nhánh đã đóng nên không sửa được thông tin/)).toBeInTheDocument();
  });
});

describe("Lifecycle buttons follow the status (Branch §4.3)", () => {
  it.each<[BranchStatus, string[]]>([
    ["DRAFT", ["Kích hoạt", "Đóng chi nhánh…"]],
    ["ACTIVE", ["Tạm ngưng…", "Đóng chi nhánh…"]],
    ["INACTIVE", ["Kích hoạt", "Đóng chi nhánh…"]],
    ["CLOSED", []],
  ])("%s offers %j", async (status, labels) => {
    const s = server({ status });
    renderAdmin("/admin/branches/b-q1", s.handlers);

    const actions = within(await screen.findByRole("group", { name: "Thao tác vòng đời" }));
    expect(actions.queryAllByRole("button").map((b) => b.textContent)).toEqual(labels);
  });

  it("activates a DRAFT Branch", async () => {
    const s = server({ status: "DRAFT", activatedAt: null });
    const { user } = renderAdmin("/admin/branches/b-q1", {
      ...s.handlers,
      "POST /branches/b-q1/activate": () => s.set({ status: "ACTIVE", activatedAt: "2026-11-03T03:00:00Z" }),
    });

    await user.click(await screen.findByRole("button", { name: "Kích hoạt" }));

    const header = within(screen.getByRole("region", { name: "Tóm tắt chi nhánh" }));
    expect(await header.findByText("Đang hoạt động")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Đã kích hoạt chi nhánh.");
  });

  it("explains BRANCH_INVALID_TRANSITION and reloads", async () => {
    const s = server({ status: "DRAFT", activatedAt: null });
    const { user } = renderAdmin("/admin/branches/b-q1", {
      ...s.handlers,
      "POST /branches/b-q1/activate": () => problem(409, "BRANCH_INVALID_TRANSITION"),
    });

    await user.click(await screen.findByRole("button", { name: "Kích hoạt" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Trạng thái chi nhánh đã thay đổi");
  });
});

describe("Deactivate (D3c screen 18)", () => {
  it("lists the open commitments from closure-check and checks again", async () => {
    const s = server();
    let open = conflicts;
    const { user } = renderAdmin("/admin/branches/b-q1", {
      ...s.handlers,
      "GET /branches/b-q1/closure-check": () => json({ conflicts: open }),
      "POST /branches/b-q1/deactivate": () => s.set({ status: "INACTIVE" }),
    });

    await user.click(await screen.findByRole("button", { name: "Tạm ngưng…" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Tạm ngưng Quận 1 · Lê Lợi?" }));
    expect(await dialog.findByRole("alert")).toHaveTextContent("Chưa tạm ngưng được");
    const items = dialog.getAllByRole("listitem").map((li) => li.textContent);
    expect(items[0]).toContain("4");
    expect(items[0]).toContain("Đơn đang xử lý");
    expect(items[1]).toContain("Đơn hẹn ngày sau");
    expect(items[2]).toContain("Phiên đặt nhóm đang mở");
    expect(dialog.getByRole("link", { name: /Mở Bảng đơn/ })).toHaveAttribute("href", "/branches/b-q1/orders");
    expect(dialog.queryByRole("button", { name: "Tạm ngưng chi nhánh" })).not.toBeInTheDocument();

    open = [];
    await user.click(dialog.getByRole("button", { name: "Kiểm tra lại" }));
    expect(await dialog.findByText("Đã kiểm tra: không còn đơn hay phiên nhóm đang mở.")).toBeInTheDocument();
    await user.click(dialog.getByRole("button", { name: "Tạm ngưng chi nhánh" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(within(screen.getByRole("region", { name: "Tóm tắt chi nhánh" })).getByText("Tạm ngưng")).toBeInTheDocument();
  });

  it("shows conflicts[] when the deactivate itself answers BRANCH_HAS_OPEN_COMMITMENTS", async () => {
    const s = server();
    const { user } = renderAdmin("/admin/branches/b-q1", { ...s.handlers, "POST /branches/b-q1/deactivate": openCommitments });

    await user.click(await screen.findByRole("button", { name: "Tạm ngưng…" }));
    const dialog = within(await screen.findByRole("dialog"));
    await user.click(await dialog.findByRole("button", { name: "Tạm ngưng chi nhánh" }));

    expect(await dialog.findByRole("alert")).toHaveTextContent("Chưa tạm ngưng được");
    expect(dialog.getAllByRole("listitem")).toHaveLength(3);
  });
});

describe("Close (D3c screen 19)", () => {
  it("unlocks the button only when the code matches, steps up on STEP_UP_REQUIRED, then closes", async () => {
    const s = server();
    let steppedUp = false;
    const { api, user } = renderAdmin("/admin/branches/b-q1", {
      ...s.handlers,
      "POST /branches/b-q1/close": () =>
        steppedUp ? s.set({ status: "CLOSED", closedAt: "2026-11-03T03:00:00Z" }) : problem(403, "STEP_UP_REQUIRED"),
      "POST /auth/step-up": () => {
        steppedUp = true;
        return noContent();
      },
    });

    await user.click(await screen.findByRole("button", { name: "Đóng chi nhánh…" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Đóng vĩnh viễn Quận 1 · Lê Lợi?" }));
    expect(await dialog.findByText("Đã kiểm tra: không còn đơn hay phiên nhóm đang mở.")).toBeInTheDocument();
    const confirm = dialog.getByRole("button", { name: "Đóng chi nhánh" });
    expect(confirm).toBeDisabled();
    await user.type(dialog.getByLabelText(/để xác nhận/), "Q1-LELO");
    expect(confirm).toBeDisabled();
    await user.type(dialog.getByLabelText(/để xác nhận/), "I");
    expect(confirm).toBeEnabled();
    await user.click(confirm);

    await user.type(await screen.findByLabelText("Mã từ ứng dụng xác thực"), "482913");
    await user.click(screen.getByRole("button", { name: "Xác thực và tiếp tục" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(within(screen.getByRole("region", { name: "Tóm tắt chi nhánh" })).getByText("Đã đóng")).toBeInTheDocument();
    expect(api.calls.filter((c) => c.route === "POST /branches/b-q1/close")).toHaveLength(2);
  });

  it("stays open and says why when the step-up is cancelled", async () => {
    const s = server();
    const { user } = renderAdmin("/admin/branches/b-q1", {
      ...s.handlers,
      "POST /branches/b-q1/close": () => problem(403, "STEP_UP_REQUIRED"),
    });

    await user.click(await screen.findByRole("button", { name: "Đóng chi nhánh…" }));
    const dialog = within(await screen.findByRole("dialog"));
    await user.type(dialog.getByLabelText(/để xác nhận/), "Q1-LELOI");
    await user.click(dialog.getByRole("button", { name: "Đóng chi nhánh" }));
    await user.click(await screen.findByRole("button", { name: "Hủy" }));

    expect(await screen.findByText(/Cần xác thực lại để đóng chi nhánh/)).toBeInTheDocument();
  });

  it("lists conflicts[] on BRANCH_HAS_OPEN_COMMITMENTS", async () => {
    const s = server();
    const { user } = renderAdmin("/admin/branches/b-q1", { ...s.handlers, "POST /branches/b-q1/close": openCommitments });

    await user.click(await screen.findByRole("button", { name: "Đóng chi nhánh…" }));
    const dialog = within(await screen.findByRole("dialog"));
    await user.type(dialog.getByLabelText(/để xác nhận/), "Q1-LELOI");
    await user.click(dialog.getByRole("button", { name: "Đóng chi nhánh" }));

    expect(await dialog.findByRole("alert")).toHaveTextContent("Chưa đóng được");
    expect(dialog.getAllByRole("listitem").map((li) => li.textContent)).toEqual(
      expect.arrayContaining([expect.stringContaining("Đơn đang xử lý")]),
    );
  });

  it("on BRANCH_INVALID_TRANSITION shows the current status and reloads", async () => {
    const s = server();
    const { user } = renderAdmin("/admin/branches/b-q1", {
      ...s.handlers,
      "POST /branches/b-q1/close": () => {
        s.set({ status: "CLOSED", closedAt: "2026-11-03T03:51:00Z" });
        return problem(409, "BRANCH_INVALID_TRANSITION");
      },
    });

    await user.click(await screen.findByRole("button", { name: "Đóng chi nhánh…" }));
    const dialog = within(await screen.findByRole("dialog"));
    await user.type(dialog.getByLabelText(/để xác nhận/), "Q1-LELOI");
    await user.click(dialog.getByRole("button", { name: "Đóng chi nhánh" }));

    expect(await screen.findByRole("dialog", { name: "Không đóng được chi nhánh" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Tải lại" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(within(screen.getByRole("region", { name: "Tóm tắt chi nhánh" })).getByText("Đã đóng")).toBeInTheDocument();
  });
});
