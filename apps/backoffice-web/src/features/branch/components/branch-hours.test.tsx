import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { json, problem } from "../../../test/fake-api";
import type { Branch } from "../branch-form";
import type { BranchBusinessHours } from "../hours-form";
import { aBranch, branchResponse, renderAdmin } from "../test/render-admin";

const PATH = "/admin/branches/b-q1/hours";

function hoursResponse(hours: BranchBusinessHours, version: number) {
  const response = json(hours);
  response.headers.set("ETag", `"v${version}"`);
  return response;
}

function invalid(errors: { field: string; code: string }[]) {
  return Response.json(
    { status: 422, code: "BRANCH_HOURS_INVALID", errors },
    { status: 422, headers: { "Content-Type": "application/problem+json" } },
  );
}

/** Branch + hours kept by the fake server; every change bumps the Branch version (Decision Q1). */
function server(initial: Partial<BranchBusinessHours> = {}, branchOverrides: Partial<Branch> = {}) {
  let branch = aBranch(branchOverrides);
  let hours: BranchBusinessHours = {
    weekly: [
      { dayOfWeek: 1, open: "07:00", close: "21:30" },
      { dayOfWeek: 5, open: "07:00", close: "14:00" },
      { dayOfWeek: 5, open: "15:00", close: "22:00" },
    ],
    overrides: [{ date: "2026-12-24", isClosed: false, intervals: [{ open: "08:00", close: "23:00" }], reason: "Giáng sinh" }],
    ...initial,
  };
  const change = (next: Partial<BranchBusinessHours>) => {
    hours = { ...hours, ...next };
    branch = { ...branch, version: branch.version + 1 };
    return hoursResponse(hours, branch.version);
  };
  /** A Branch command (e.g. activate): the hours stay, the version moves. */
  const command = (next: Partial<Branch>) => {
    branch = { ...branch, ...next, version: branch.version + 1 };
    return branchResponse(branch);
  };
  return {
    get hours() {
      return hours;
    },
    change,
    command,
    handlers: {
      "GET /branches/b-q1": () => branchResponse(branch),
      "GET /branches/b-q1/business-hours": () => hoursResponse(hours, branch.version),
    },
  };
}

/** Waits for the weekly table, which comes after the Branch and its hours load. */
async function loaded() {
  await screen.findByRole("table", { name: "Lịch hàng tuần" });
}

function row(day: string) {
  return within(screen.getByRole("row", { name: new RegExp(`^${day}`) }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Weekly hours (D3c screen 17)", () => {
  it("shows the week from the API, one row per day, and opens from the tab", async () => {
    const s = server();
    const { user, router } = renderAdmin("/admin/branches/b-q1", s.handlers);

    await user.click(await screen.findByRole("link", { name: "Giờ mở cửa" }));
    expect(router.state.location.pathname).toBe(PATH);
    expect(await screen.findByRole("heading", { name: "Lịch hàng tuần" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Giờ mở cửa" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("navigation", { name: "Vị trí" })).toHaveTextContent("Chi nhánh / Quận 1 · Lê Lợi / Giờ mở cửa");

    expect(row("Thứ Hai").getByLabelText("Thứ Hai khoảng 1 mở")).toHaveValue("07:00");
    expect(row("Thứ Hai").getByLabelText("Thứ Hai khoảng 1 đóng")).toHaveValue("21:30");
    expect(row("Thứ Sáu").getByLabelText("Thứ Sáu khoảng 2 mở")).toHaveValue("15:00");
    expect(row("Thứ Ba").getByRole("checkbox", { name: /Đóng/ })).toBeChecked();
    expect(row("Thứ Ba").getByText("Đóng cửa")).toBeInTheDocument();
  });

  it("saves the whole week with If-Match: added interval, closed and reopened days", async () => {
    const s = server();
    const { api, user } = renderAdmin(PATH, {
      ...s.handlers,
      "PUT /branches/b-q1/business-hours": (body) => s.change({ weekly: (body as BranchBusinessHours).weekly }),
    });

    await loaded();
    await user.click(row("Thứ Hai").getByRole("button", { name: "Thêm khoảng cho Thứ Hai" }));
    const open2 = row("Thứ Hai").getByLabelText("Thứ Hai khoảng 2 mở");
    const close2 = row("Thứ Hai").getByLabelText("Thứ Hai khoảng 2 đóng");
    await user.clear(open2);
    await user.type(open2, "22:00");
    await user.clear(close2);
    await user.type(close2, "23:00");
    await user.click(row("Thứ Sáu").getByRole("checkbox", { name: /Đóng/ }));
    await user.click(row("Chủ nhật").getByRole("checkbox", { name: /Đóng/ }));
    await user.click(screen.getByRole("button", { name: "Lưu lịch tuần" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Đã lưu lịch tuần.");
    expect(api.bodyOf("PUT /branches/b-q1/business-hours")).toEqual({
      weekly: [
        { dayOfWeek: 1, open: "07:00", close: "21:30" },
        { dayOfWeek: 1, open: "22:00", close: "23:00" },
        { dayOfWeek: 7, open: "07:00", close: "21:00" },
      ],
    });
    expect(api.calls.findLast((c) => c.route === "PUT /branches/b-q1/business-hours")?.headers.get("If-Match")).toBe('"v3"');
  });

  it("removes an interval", async () => {
    const s = server();
    const { api, user } = renderAdmin(PATH, {
      ...s.handlers,
      "PUT /branches/b-q1/business-hours": (body) => s.change({ weekly: (body as BranchBusinessHours).weekly }),
    });

    await loaded();
    await user.click(row("Thứ Sáu").getByRole("button", { name: "Xoá khoảng 2 của Thứ Sáu" }));
    expect(row("Thứ Hai").queryByRole("button", { name: /Xoá khoảng/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Lưu lịch tuần" }));

    await screen.findByRole("status");
    expect(api.bodyOf("PUT /branches/b-q1/business-hours")).toEqual({
      weekly: [
        { dayOfWeek: 1, open: "07:00", close: "21:30" },
        { dayOfWeek: 5, open: "07:00", close: "14:00" },
      ],
    });
  });

  it("marks the row of a 422 BRANCH_HOURS_INVALID error and says how many days to fix", async () => {
    const s = server();
    const { user } = renderAdmin(PATH, {
      ...s.handlers,
      // Request order: Mon[0], Fri[0], Fri[1] → weekly[2] is Friday's second interval.
      "PUT /branches/b-q1/business-hours": () => invalid([{ field: "weekly[2]", code: "OVERLAPPING" }]),
    });

    await user.click(await screen.findByRole("button", { name: "Lưu lịch tuần" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Chưa lưu được: 1 ngày có giờ không hợp lệ.");
    const friday = row("Thứ Sáu");
    expect(friday.getByText(/chồng lên một khoảng khác/)).toBeInTheDocument();
    expect(friday.getByLabelText("Thứ Sáu khoảng 2 mở")).toHaveAttribute("aria-invalid", "true");
    expect(friday.getByLabelText("Thứ Sáu khoảng 1 mở")).not.toHaveAttribute("aria-invalid");
    expect(row("Thứ Hai").getByLabelText("Thứ Hai khoảng 1 mở")).not.toHaveAttribute("aria-invalid");
    await waitFor(() => expect(friday.getByLabelText("Thứ Sáu khoảng 2 mở")).toHaveFocus());
  });

  it("keeps unsaved weekly edits when a special day is added or deleted, and saves with the new version", async () => {
    const s = server();
    const { api, user } = renderAdmin(PATH, {
      ...s.handlers,
      "POST /branches/b-q1/business-hour-overrides": (body) =>
        s.change({ overrides: [...s.hours.overrides, body as BranchBusinessHours["overrides"][number]] }),
      "DELETE /branches/b-q1/business-hour-overrides/2026-12-24": () =>
        s.change({ overrides: s.hours.overrides.filter((o) => o.date !== "2026-12-24") }),
      "PUT /branches/b-q1/business-hours": (body) => s.change({ weekly: (body as BranchBusinessHours).weekly }),
    });

    await loaded();
    await user.click(row("Thứ Ba").getByRole("checkbox", { name: /Đóng/ }));
    const form = within(screen.getByRole("form", { name: "Thêm ngày" }));
    await user.type(form.getByLabelText("Ngày"), "2027-01-01");
    await user.click(form.getByRole("checkbox", { name: "Đóng cả ngày" }));
    await user.click(form.getByRole("button", { name: "Thêm ngày đặc biệt" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Đã lưu ngày đặc biệt 01/01/2027.");
    await user.click(screen.getByRole("button", { name: "Xoá ngày đặc biệt 24/12/2026" }));
    expect(await screen.findByText("Đã xoá ngày đặc biệt 24/12/2026.")).toBeInTheDocument();

    expect(row("Thứ Ba").getByRole("checkbox", { name: /Đóng/ })).not.toBeChecked();
    await user.click(screen.getByRole("button", { name: "Lưu lịch tuần" }));

    expect(await screen.findByText("Đã lưu lịch tuần.")).toBeInTheDocument();
    expect(api.bodyOf("PUT /branches/b-q1/business-hours")).toEqual({
      weekly: [
        { dayOfWeek: 1, open: "07:00", close: "21:30" },
        { dayOfWeek: 2, open: "07:00", close: "21:00" },
        { dayOfWeek: 5, open: "07:00", close: "14:00" },
        { dayOfWeek: 5, open: "15:00", close: "22:00" },
      ],
    });
    // Two override changes moved the Branch from v3 to v5.
    expect(api.calls.findLast((c) => c.route === "PUT /branches/b-q1/business-hours")?.headers.get("If-Match")).toBe('"v5"');
  });

  it("after a lifecycle command on this tab, saves the week with the Branch's new version", async () => {
    const s = server({}, { status: "DRAFT", activatedAt: null });
    const { api, user } = renderAdmin(PATH, {
      ...s.handlers,
      "POST /branches/b-q1/activate": () => s.command({ status: "ACTIVE", activatedAt: "2026-11-03T03:00:00Z" }),
      "PUT /branches/b-q1/business-hours": (body) => s.change({ weekly: (body as BranchBusinessHours).weekly }),
    });

    await loaded();
    await user.click(screen.getByRole("button", { name: "Kích hoạt" }));
    expect(await screen.findByText("Đã kích hoạt chi nhánh.")).toBeInTheDocument();
    await waitFor(() => expect(api.calls.filter((c) => c.route === "GET /branches/b-q1/business-hours")).toHaveLength(2));
    await user.click(screen.getByRole("button", { name: "Lưu lịch tuần" }));

    expect(await screen.findByText("Đã lưu lịch tuần.")).toBeInTheDocument();
    expect(api.calls.findLast((c) => c.route === "PUT /branches/b-q1/business-hours")?.headers.get("If-Match")).toBe('"v4"');
  });

  it("stops an empty time on the client and marks its row", async () => {
    const s = server();
    const { api, user } = renderAdmin(PATH, s.handlers);

    await loaded();
    await user.clear(row("Thứ Hai").getByLabelText("Thứ Hai khoảng 1 đóng"));
    await user.click(screen.getByRole("button", { name: "Lưu lịch tuần" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Chưa lưu được: 1 ngày có giờ không hợp lệ.");
    expect(row("Thứ Hai").getByText("Nhập giờ mở và giờ đóng, hoặc chọn Đóng cả ngày.")).toBeInTheDocument();
    await waitFor(() => expect(row("Thứ Hai").getByLabelText("Thứ Hai khoảng 1 mở")).toHaveFocus());
    expect(api.calls.some((c) => c.route === "PUT /branches/b-q1/business-hours")).toBe(false);
  });

  it("drops the server's interval errors once the intervals of the week change", async () => {
    const s = server();
    const { user } = renderAdmin(PATH, {
      ...s.handlers,
      "PUT /branches/b-q1/business-hours": () => invalid([{ field: "weekly[2]", code: "OVERLAPPING" }]),
    });

    await user.click(await screen.findByRole("button", { name: "Lưu lịch tuần" }));
    expect(await row("Thứ Sáu").findByText(/chồng lên một khoảng khác/)).toBeInTheDocument();
    await user.click(row("Thứ Sáu").getByRole("button", { name: "Xoá khoảng 1 của Thứ Sáu" }));

    // weekly[2] pointed at Friday's second interval, which is now the first one: the old mark would be wrong.
    expect(row("Thứ Sáu").queryByText(/chồng lên một khoảng khác/)).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("on 412 VERSION_CONFLICT says the hours changed and reloads them", async () => {
    const s = server();
    const { user } = renderAdmin(PATH, { ...s.handlers, "PUT /branches/b-q1/business-hours": () => problem(412, "VERSION_CONFLICT") });

    await loaded();
    await user.click(row("Thứ Hai").getByRole("checkbox", { name: /Đóng/ }));
    s.change({ weekly: [{ dayOfWeek: 2, open: "09:00", close: "17:00" }] });
    await user.click(screen.getByRole("button", { name: "Lưu lịch tuần" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("vừa được người khác cập nhật");
    await user.click(screen.getByRole("button", { name: "Tải lại" }));

    await waitFor(() => expect(row("Thứ Ba").getByLabelText("Thứ Ba khoảng 1 mở")).toHaveValue("09:00"));
    expect(row("Thứ Hai").getByRole("checkbox", { name: /Đóng/ })).toBeChecked();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("Special days (D3c screen 17)", () => {
  it("lists the upcoming special days", async () => {
    const s = server({
      overrides: [
        { date: "2026-12-24", isClosed: false, intervals: [{ open: "08:00", close: "23:00" }], reason: "Giáng sinh" },
        { date: "2027-01-01", isClosed: true, intervals: [], reason: null },
      ],
    });
    renderAdmin(PATH, s.handlers);

    const list = within(await screen.findByRole("list", { name: "Ngày đặc biệt sắp tới" }));
    const items = list.getAllByRole("listitem").map((li) => li.textContent);
    expect(items[0]).toContain("24/12/2026 · 08:00–23:00");
    expect(items[0]).toContain("Giáng sinh");
    expect(items[1]).toContain("01/01/2027 · Đóng cả ngày");
  });

  it("adds a day with its own hours and a reason", async () => {
    const s = server({ overrides: [] });
    const { api, user } = renderAdmin(PATH, {
      ...s.handlers,
      "POST /branches/b-q1/business-hour-overrides": (body) => s.change({ overrides: [body as BranchBusinessHours["overrides"][number]] }),
    });

    expect(await screen.findByText("Chưa có ngày đặc biệt nào sắp tới.")).toBeInTheDocument();
    const form = within(screen.getByRole("form", { name: "Thêm ngày" }));
    await user.type(form.getByLabelText("Ngày"), "2026-12-24");
    await user.clear(form.getByLabelText("Giờ mở ngày đặc biệt"));
    await user.type(form.getByLabelText("Giờ mở ngày đặc biệt"), "08:00");
    await user.clear(form.getByLabelText("Giờ đóng ngày đặc biệt"));
    await user.type(form.getByLabelText("Giờ đóng ngày đặc biệt"), "23:00");
    await user.type(form.getByLabelText("Lý do"), "Giáng sinh");
    await user.click(form.getByRole("button", { name: "Thêm ngày đặc biệt" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Đã lưu ngày đặc biệt 24/12/2026.");
    expect(api.bodyOf("POST /branches/b-q1/business-hour-overrides")).toEqual({
      date: "2026-12-24",
      isClosed: false,
      intervals: [{ open: "08:00", close: "23:00" }],
      reason: "Giáng sinh",
    });
    expect(within(screen.getByRole("list", { name: "Ngày đặc biệt sắp tới" })).getByText(/24\/12\/2026/)).toBeInTheDocument();
  });

  it("adds a closed day without intervals", async () => {
    const s = server({ overrides: [] });
    const { api, user } = renderAdmin(PATH, {
      ...s.handlers,
      "POST /branches/b-q1/business-hour-overrides": (body) => s.change({ overrides: [body as BranchBusinessHours["overrides"][number]] }),
    });

    const form = within(await screen.findByRole("form", { name: "Thêm ngày" }));
    await user.type(form.getByLabelText("Ngày"), "2027-01-01");
    await user.click(form.getByRole("checkbox", { name: "Đóng cả ngày" }));
    expect(form.getByLabelText("Giờ mở ngày đặc biệt")).toBeDisabled();
    await user.click(form.getByRole("button", { name: "Thêm ngày đặc biệt" }));

    await screen.findByRole("status");
    expect(api.bodyOf("POST /branches/b-q1/business-hour-overrides")).toEqual({
      date: "2027-01-01",
      isClosed: true,
      intervals: [],
      reason: null,
    });
  });

  it("shows the server's DATE_IN_PAST on the date field", async () => {
    const s = server({ overrides: [] });
    const { user } = renderAdmin(PATH, {
      ...s.handlers,
      "POST /branches/b-q1/business-hour-overrides": () => invalid([{ field: "date", code: "DATE_IN_PAST" }]),
    });

    const form = within(await screen.findByRole("form", { name: "Thêm ngày" }));
    // Valid for the browser (no earlier than its "today"), but already past for the server, e.g. just after midnight.
    await user.type(form.getByLabelText("Ngày"), "2099-01-01");
    await user.click(form.getByRole("button", { name: "Thêm ngày đặc biệt" }));

    expect(await form.findByText("Ngày này đã qua. Chọn hôm nay hoặc một ngày sau.")).toBeInTheDocument();
    expect(form.getByLabelText("Ngày")).toHaveAttribute("aria-invalid", "true");
    expect(form.getByLabelText("Ngày")).toHaveFocus();
  });

  it("puts the keyboard on the hours when the server refuses them", async () => {
    const s = server({ overrides: [] });
    const { user } = renderAdmin(PATH, {
      ...s.handlers,
      "POST /branches/b-q1/business-hour-overrides": () => invalid([{ field: "intervals[0]", code: "OPEN_NOT_BEFORE_CLOSE" }]),
    });

    const form = within(await screen.findByRole("form", { name: "Thêm ngày" }));
    await user.type(form.getByLabelText("Ngày"), "2099-01-01");
    await user.click(form.getByRole("button", { name: "Thêm ngày đặc biệt" }));

    expect(await form.findByText("Giờ mở phải trước giờ đóng (đóng muộn nhất 23:59).")).toBeInTheDocument();
    expect(form.getByLabelText("Giờ mở ngày đặc biệt")).toHaveFocus();
  });

  it("deletes a special day", async () => {
    const s = server();
    const { user } = renderAdmin(PATH, {
      ...s.handlers,
      "DELETE /branches/b-q1/business-hour-overrides/2026-12-24": () => s.change({ overrides: [] }),
    });

    await user.click(await screen.findByRole("button", { name: "Xoá ngày đặc biệt 24/12/2026" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Đã xoá ngày đặc biệt 24/12/2026.");
    expect(screen.getByText("Chưa có ngày đặc biệt nào sắp tới.")).toBeInTheDocument();
  });

  it("on 404 BRANCH_HOURS_OVERRIDE_NOT_FOUND says it was already gone and reloads", async () => {
    const s = server();
    const { user } = renderAdmin(PATH, {
      ...s.handlers,
      "DELETE /branches/b-q1/business-hour-overrides/2026-12-24": () => {
        s.change({ overrides: [] });
        return problem(404, "BRANCH_HOURS_OVERRIDE_NOT_FOUND");
      },
    });

    await user.click(await screen.findByRole("button", { name: "Xoá ngày đặc biệt 24/12/2026" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("đã được xoá trước đó");
    expect(await screen.findByText("Chưa có ngày đặc biệt nào sắp tới.")).toBeInTheDocument();
  });
});

describe("Special days on a Branch closed meanwhile (409 BRANCH_INVALID_TRANSITION)", () => {
  const closedText = "Chi nhánh đã đóng nên không sửa được giờ mở cửa nữa. Tải lại trang để xem trạng thái mới nhất.";

  it("says so when adding a day", async () => {
    const s = server({ overrides: [] });
    const { user } = renderAdmin(PATH, {
      ...s.handlers,
      "POST /branches/b-q1/business-hour-overrides": () => problem(409, "BRANCH_INVALID_TRANSITION"),
    });

    const form = within(await screen.findByRole("form", { name: "Thêm ngày" }));
    await user.type(form.getByLabelText("Ngày"), "2027-01-01");
    await user.click(form.getByRole("button", { name: "Thêm ngày đặc biệt" }));

    expect(await form.findByRole("alert")).toHaveTextContent(closedText);
  });

  it("says so when deleting a day", async () => {
    const s = server();
    const { user } = renderAdmin(PATH, {
      ...s.handlers,
      "DELETE /branches/b-q1/business-hour-overrides/2026-12-24": () => problem(409, "BRANCH_INVALID_TRANSITION"),
    });

    await user.click(await screen.findByRole("button", { name: "Xoá ngày đặc biệt 24/12/2026" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(closedText);
  });
});

describe("A CLOSED Branch (Decision Q1)", () => {
  it("shows the hours read-only", async () => {
    const s = server({}, { status: "CLOSED", closedAt: "2026-10-20T03:00:00Z" });
    renderAdmin(PATH, s.handlers);

    expect(await screen.findByText("Chi nhánh đã đóng nên không sửa được giờ mở cửa.")).toBeInTheDocument();
    expect(row("Thứ Hai").getByLabelText("Thứ Hai khoảng 1 mở")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Lưu lịch tuần" })).not.toBeInTheDocument();
    expect(screen.queryByRole("form", { name: "Thêm ngày" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Xoá ngày đặc biệt/ })).not.toBeInTheDocument();
  });
});
