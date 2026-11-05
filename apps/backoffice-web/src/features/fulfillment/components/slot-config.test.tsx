import { todayInBranch } from "@hayi/domain-utils";
import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Me } from "../../../lib/scope";
import { json, problem } from "../../../test/fake-api";
import { aBranch, renderAdmin } from "../../branch/test/render-admin";
import type { FulfillmentConfig, PickupSchedule } from "../api/fulfillment";
import type { OverbookedSlot, ScheduleWindow } from "../schedule-form";

const PATH = "/branches/b-q1/slots";
const BASE = "/branches/b-q1/fulfillment/configs";

const manager: Me = {
  userId: "u-m",
  email: "minh@hayi.vn",
  displayName: "Trần Minh",
  mfaEnrolled: true,
  storeRoles: [],
  storePermissions: [],
  branches: [{ branchId: "b-q1", roles: ["MANAGER"], permissions: ["BRANCH_VIEW", "FULFILLMENT_CONFIG_MANAGE"] }],
};

function tagged(body: unknown, version: number, status = 200) {
  const response = json(body, status);
  response.headers.set("ETag", `"v${version}"`);
  return response;
}

function invalid(code: string, errors: { field: string; code: string }[]) {
  return Response.json(
    { status: 422, code, errors },
    { status: 422, headers: { "Content-Type": "application/problem+json" } },
  );
}

/** Config + schedule kept by the fake server; every change bumps the one version (Decision S1). */
function server({ isEnabled = false }: { isEnabled?: boolean } = {}) {
  let version = 3;
  let config: FulfillmentConfig = {
    fulfillmentType: "PICKUP",
    isEnabled,
    asapEnabled: false,
    maxAdvanceDays: 7,
    slotDurationMinutes: 15,
    sameDayCutoffMinutes: 180,
    minLeadMinutes: 30,
    groupOrderMinLeadMinutes: null,
    customerCancelCutoffMinutes: 60,
    defaultSlotMaxOrders: 15,
    defaultSlotMaxItems: null,
    pickupInstructions: null,
    version,
    overbookedSlots: [],
  };
  let schedule: PickupSchedule = {
    weekly: [
      { dayOfWeek: 1, start: "07:30", end: "11:00", maxOrders: 8, maxItems: 20 },
      { dayOfWeek: 1, start: "13:30", end: "21:00", maxOrders: 8, maxItems: 20 },
      { dayOfWeek: 7, start: "08:30", end: "17:00", maxOrders: null, maxItems: null },
    ],
    overrides: [
      { overrideId: "o-1", date: "2026-12-24", isClosed: false, start: "08:00", end: "12:00", maxOrders: 20, maxItems: null, reason: "Noel" },
      { overrideId: "o-2", date: "2026-12-24", isClosed: false, start: "14:00", end: "18:00", maxOrders: 20, maxItems: null, reason: "Noel" },
      { overrideId: "o-3", date: "2027-01-01", isClosed: true, start: null, end: null, maxOrders: null, maxItems: null, reason: null },
    ],
    overbookedSlots: [],
  };
  let overbooked: OverbookedSlot[] = [];
  const bump = () => (version += 1);
  return {
    get version() {
      return version;
    },
    setOverbooked(slots: OverbookedSlot[]) {
      overbooked = slots;
    },
    putConfig(body: unknown) {
      config = { ...config, ...(body as object), version: bump(), overbookedSlots: overbooked };
      return tagged(config, version);
    },
    replaceWeekly(body: unknown) {
      schedule = { ...schedule, weekly: (body as { weekly: ScheduleWindow[] }).weekly };
      bump();
      return tagged({ ...schedule, overbookedSlots: overbooked }, version);
    },
    changeOverrides(overrides: PickupSchedule["overrides"]) {
      schedule = { ...schedule, overrides };
      bump();
      return tagged({ ...schedule, overbookedSlots: overbooked }, version);
    },
    get schedule() {
      return schedule;
    },
    handlers: {
      "GET /branches": () => json({ items: [aBranch({})] }),
      "GET /branches/b-q1/business-hours": () =>
        tagged(
          {
            weekly: [1, 2, 3, 4, 5]
              .map((d) => ({ dayOfWeek: d, open: "07:00", close: "21:30" }))
              .concat({ dayOfWeek: 6, open: "08:00", close: "22:00" }, { dayOfWeek: 7, open: "08:00", close: "21:30" }),
            overrides: [],
          },
          3,
        ),
      [`GET ${BASE}`]: () => json({ items: [{ ...config, version }] }),
      [`GET ${BASE}/PICKUP/schedule`]: () => tagged(schedule, version),
      "GET /branches/b-q1/fulfillment/capacity": (_: unknown, request: Request) =>
        json({
          date: new URL(request.url).searchParams.get("date"),
          fulfillmentType: "PICKUP",
          slots: [
            { slotStart: "14:00", slotEnd: "14:15", usedOrders: 0, maxOrders: 8, usedItems: 0, maxItems: 20, status: "CUTOFF_PASSED" },
            { slotStart: "14:15", slotEnd: "14:30", usedOrders: 6, maxOrders: 8, usedItems: 10, maxItems: 20, status: "NEARLY_FULL" },
            { slotStart: "14:30", slotEnd: "14:45", usedOrders: 8, maxOrders: 8, usedItems: 12, maxItems: 20, status: "FULL" },
            { slotStart: "14:45", slotEnd: "15:00", usedOrders: 1, maxOrders: 8, usedItems: 2, maxItems: 20, status: "AVAILABLE" },
            // Cups run out before orders do.
            { slotStart: "15:00", slotEnd: "15:15", usedOrders: 2, maxOrders: 8, usedItems: 17, maxItems: 20, status: "NEARLY_FULL" },
          ],
        }),
    } as Record<string, (body: unknown, request: Request) => Response>,
  };
}

async function loaded() {
  await screen.findByRole("table", { name: "Lịch nhận đơn hàng tuần" });
}

function row(day: string) {
  return within(screen.getByRole("row", { name: new RegExp(`^${day}`) }));
}

function ifMatchOf(api: ReturnType<typeof renderAdmin>["api"], route: string) {
  return api.calls.findLast((c) => c.route === route)?.headers.get("If-Match");
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Pickup schedule — weekly (D3b screen 13)", () => {
  it("shows each day's opening hours, pickup windows, slot length and capacity, and the rules", async () => {
    const s = server();
    renderAdmin(PATH, s.handlers, manager);

    expect(await screen.findByRole("heading", { level: 1, name: "Khung giờ nhận đơn" })).toBeInTheDocument();
    await loaded();
    expect(row("Thứ Hai").getByText("07:00–21:30")).toBeInTheDocument();
    expect(row("Thứ Hai").getByLabelText("Thứ Hai khung 2 bắt đầu")).toHaveValue("13:30");
    expect(row("Thứ Hai").getByLabelText("Tối đa đơn Thứ Hai")).toHaveValue(8);
    expect(row("Thứ Hai").getByText("15 phút")).toBeInTheDocument();
    expect(row("Thứ Ba").getByText("Không nhận đơn")).toBeInTheDocument();
    // Empty capacity = the config's default.
    expect(row("Chủ nhật").getByLabelText("Tối đa đơn Chủ nhật")).toHaveValue(null);

    const rules = within(screen.getByRole("region", { name: "Quy tắc đặt trước" }));
    expect(rules.getByRole("checkbox", { name: "Nhận đơn lấy tại quầy" })).not.toBeChecked();
    expect(rules.getByLabelText(/Đặt trước giờ lấy tối thiểu/)).toHaveValue(180);
    expect(rules.getByLabelText("Cho đặt trước tối đa")).toHaveValue(7);
    expect(rules.getByLabelText("Độ dài mỗi khung")).toHaveValue("15");
    expect(rules.getByLabelText(/Khách tự huỷ/)).toHaveValue(60);
    expect(screen.getByRole("tab", { name: /Ngày đặc biệt\s*2/ })).toBeInTheDocument();
  });

  it("saves the rules, then the week, each with If-Match on the version the other left", async () => {
    const s = server();
    const { api, user } = renderAdmin(
      PATH,
      { ...s.handlers, [`PUT ${BASE}/PICKUP`]: (b) => s.putConfig(b), [`PUT ${BASE}/PICKUP/weekly-schedule`]: (b) => s.replaceWeekly(b) },
      manager,
    );

    await loaded();
    const rules = within(screen.getByRole("region", { name: "Quy tắc đặt trước" }));
    await user.click(rules.getByRole("checkbox", { name: "Nhận đơn lấy tại quầy" }));
    await user.clear(rules.getByLabelText(/Đặt trước giờ lấy tối thiểu/));
    await user.type(rules.getByLabelText(/Đặt trước giờ lấy tối thiểu/), "120");
    await user.click(row("Thứ Ba").getByRole("button", { name: "Thêm khung cho Thứ Ba" }));
    await user.type(row("Thứ Ba").getByLabelText("Tối đa đơn Thứ Ba"), "6");
    await user.click(screen.getByRole("button", { name: "Lưu thay đổi" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Đã lưu khung giờ nhận đơn.");
    expect(api.bodyOf(`PUT ${BASE}/PICKUP`)).toMatchObject({ isEnabled: true, sameDayCutoffMinutes: 120, minLeadMinutes: 30 });
    expect(ifMatchOf(api, `PUT ${BASE}/PICKUP`)).toBe('"v3"');
    expect(ifMatchOf(api, `PUT ${BASE}/PICKUP/weekly-schedule`)).toBe('"v4"');
    expect((api.bodyOf(`PUT ${BASE}/PICKUP/weekly-schedule`) as { weekly: ScheduleWindow[] }).weekly).toContainEqual({
      dayOfWeek: 2,
      start: "07:30",
      end: "21:00",
      maxOrders: 6,
      maxItems: null,
    });
    expect(screen.getByRole("button", { name: "Hoàn tác" })).toBeDisabled();
  });

  it("saves only what changed", async () => {
    const s = server();
    const { api, user } = renderAdmin(
      PATH,
      { ...s.handlers, [`PUT ${BASE}/PICKUP/weekly-schedule`]: (b) => s.replaceWeekly(b) },
      manager,
    );

    await loaded();
    await user.click(row("Thứ Hai").getByRole("button", { name: "Xoá khung 2 của Thứ Hai" }));
    await user.click(screen.getByRole("button", { name: "Lưu thay đổi" }));

    await screen.findByRole("status");
    expect(api.calls.some((c) => c.route === `PUT ${BASE}/PICKUP`)).toBe(false);
    expect(ifMatchOf(api, `PUT ${BASE}/PICKUP/weekly-schedule`)).toBe('"v3"');
  });

  it("undoes unsaved changes", async () => {
    const s = server();
    const { user } = renderAdmin(PATH, s.handlers, manager);

    await loaded();
    await user.click(row("Thứ Hai").getByRole("button", { name: "Xoá khung 2 của Thứ Hai" }));
    await user.selectOptions(screen.getByLabelText("Độ dài mỗi khung"), "30");
    expect(row("Thứ Hai").getByText("30 phút")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Hoàn tác" }));

    expect(row("Thứ Hai").getByLabelText("Thứ Hai khung 2 bắt đầu")).toHaveValue("13:30");
    expect(screen.getByLabelText("Độ dài mỗi khung")).toHaveValue("15");
    expect(screen.getByRole("button", { name: "Hoàn tác" })).toBeDisabled();
  });

  it.each([
    ["FULFILLMENT_OUTSIDE_BRANCH_HOURS", "OUTSIDE_BRANCH_HOURS", "Chủ nhật: khung 08:30–17:00 nằm ngoài giờ mở cửa."],
    ["FULFILLMENT_SCHEDULE_OVERLAP", "OVERLAPPING", "Chủ nhật: khung 08:30–17:00 chồng lên một khung khác."],
  ])("shows %s on the window it names", async (code, errorCode, text) => {
    const s = server();
    const { user } = renderAdmin(
      PATH,
      // Request order: Mon[0], Mon[1], Sun[0] → weekly[2] is Sunday's window.
      { ...s.handlers, [`PUT ${BASE}/PICKUP/weekly-schedule`]: () => invalid(code, [{ field: "weekly[2]", code: errorCode }]) },
      manager,
    );

    await loaded();
    await user.click(row("Thứ Hai").getByRole("button", { name: "Xoá khung 2 của Thứ Hai" }));
    await user.click(row("Thứ Hai").getByRole("button", { name: "Thêm khung cho Thứ Hai" }));
    await user.click(screen.getByRole("button", { name: "Lưu thay đổi" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(text);
    expect(alert).toHaveTextContent("Bạn sửa lại trước khi lưu nhé.");
    expect(row("Chủ nhật").getByLabelText("Chủ nhật khung 1 bắt đầu")).toHaveAttribute("aria-invalid", "true");
    expect(row("Thứ Hai").getByLabelText("Thứ Hai khung 1 bắt đầu")).not.toHaveAttribute("aria-invalid");
    await waitFor(() => expect(row("Chủ nhật").getByLabelText("Chủ nhật khung 1 bắt đầu")).toHaveFocus());
  });

  it("warns when the windows of a day carry different capacities, since the screen sets one per day", async () => {
    const s = server();
    const handlers = {
      ...s.handlers,
      [`GET ${BASE}/PICKUP/schedule`]: () =>
        tagged(
          {
            ...s.schedule,
            weekly: [
              { dayOfWeek: 1, start: "07:30", end: "11:00", maxOrders: 8, maxItems: 20 },
              { dayOfWeek: 1, start: "13:30", end: "21:00", maxOrders: 12, maxItems: 20 },
            ],
          },
          3,
        ),
    };
    renderAdmin(PATH, handlers, manager);

    await loaded();
    expect(row("Thứ Hai").getByText("Các khung trong ngày đang có sức chứa khác nhau; lưu sẽ áp một mức cho cả ngày.")).toBeInTheDocument();
    expect(row("Thứ Ba").queryByText(/sức chứa khác nhau/)).not.toBeInTheDocument();
  });

  it("stops a window without times on the client", async () => {
    const s = server();
    const { api, user } = renderAdmin(PATH, s.handlers, manager);

    await loaded();
    await user.clear(row("Thứ Hai").getByLabelText("Thứ Hai khung 1 kết thúc"));
    await user.click(screen.getByRole("button", { name: "Lưu thay đổi" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Thứ Hai: khung 1 chưa có giờ bắt đầu hoặc kết thúc.");
    expect(api.calls.some((c) => c.route.startsWith("PUT"))).toBe(false);
  });

  it("warns about slots that already hold more orders than the new capacity", async () => {
    const s = server();
    s.setOverbooked([{ date: "2026-12-05", slotStart: "14:30", slotEnd: "14:45", usedOrders: 9, maxOrders: 6, usedItems: 12, maxItems: null }]);
    const { user } = renderAdmin(
      PATH,
      { ...s.handlers, [`PUT ${BASE}/PICKUP/weekly-schedule`]: (b) => s.replaceWeekly(b) },
      manager,
    );

    await loaded();
    await user.clear(row("Thứ Hai").getByLabelText("Tối đa đơn Thứ Hai"));
    await user.type(row("Thứ Hai").getByLabelText("Tối đa đơn Thứ Hai"), "6");
    await user.click(screen.getByRole("button", { name: "Lưu thay đổi" }));

    const warning = await screen.findByRole("region", { name: "Khung đã nhận nhiều đơn hơn sức chứa mới" });
    expect(warning).toHaveTextContent("05/12/2026 14:30–14:45: 9 đơn / tối đa 6");
    expect(warning).toHaveTextContent("Đơn đã đặt không bị huỷ.");
  });

  it("on 412 VERSION_CONFLICT says someone else changed it and reloads", async () => {
    const s = server();
    const { user } = renderAdmin(
      PATH,
      { ...s.handlers, [`PUT ${BASE}/PICKUP/weekly-schedule`]: () => problem(412, "VERSION_CONFLICT") },
      manager,
    );

    await loaded();
    await user.click(row("Thứ Hai").getByRole("button", { name: "Xoá khung 2 của Thứ Hai" }));
    await user.click(screen.getByRole("button", { name: "Lưu thay đổi" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("vừa được người khác cập nhật");
    await user.click(screen.getByRole("button", { name: "Tải lại" }));

    await waitFor(() => expect(row("Thứ Hai").getByLabelText("Thứ Hai khung 2 bắt đầu")).toHaveValue("13:30"));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("says what was saved when the rules were saved but the week was not", async () => {
    const s = server();
    const { user } = renderAdmin(
      PATH,
      {
        ...s.handlers,
        [`PUT ${BASE}/PICKUP`]: (b) => s.putConfig(b),
        [`PUT ${BASE}/PICKUP/weekly-schedule`]: () =>
          invalid("FULFILLMENT_OUTSIDE_BRANCH_HOURS", [{ field: "weekly[2]", code: "OUTSIDE_BRANCH_HOURS" }]),
      },
      manager,
    );

    await loaded();
    await user.click(screen.getByRole("checkbox", { name: "Nhận đơn lấy tại quầy" }));
    await user.click(row("Thứ Hai").getByRole("button", { name: "Xoá khung 2 của Thứ Hai" }));
    await user.click(screen.getByRole("button", { name: "Lưu thay đổi" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Đã lưu quy tắc đặt trước, nhưng lịch tuần chưa lưu.");
    // The rules are saved: still checked, no longer a change to undo by themselves.
    expect(screen.getByRole("checkbox", { name: "Nhận đơn lấy tại quầy" })).toBeChecked();
  });
});

describe("Pickup schedule — special days", () => {
  it("lists the special days from today, one line per window", async () => {
    const s = server();
    const { user } = renderAdmin(PATH, s.handlers, manager);

    await user.click(await screen.findByRole("tab", { name: /Ngày đặc biệt/ }));

    const list = within(screen.getByRole("list", { name: "Ngày đặc biệt sắp tới" }));
    const items = list.getAllByRole("listitem").map((li) => li.textContent);
    expect(items[0]).toContain("24/12/2026 · 08:00–12:00 · tối đa 20 đơn");
    expect(items[0]).toContain("Noel");
    expect(items[1]).toContain("24/12/2026 · 14:00–18:00");
    expect(items[2]).toContain("01/01/2027 · Không nhận đơn cả ngày");
  });

  it("adds a day with its windows and capacity", async () => {
    const s = server();
    const { api, user } = renderAdmin(
      PATH,
      {
        ...s.handlers,
        [`POST ${BASE}/PICKUP/overrides`]: () =>
          s.changeOverrides([
            ...s.schedule.overrides,
            { overrideId: "o-9", date: "2026-12-31", isClosed: false, start: "08:00", end: "11:00", maxOrders: 5, maxItems: null, reason: "Tất niên" },
          ]),
      },
      manager,
    );

    await user.click(await screen.findByRole("tab", { name: /Ngày đặc biệt/ }));
    const form = within(screen.getByRole("form", { name: "Thêm ngày đặc biệt" }));
    await user.type(form.getByLabelText("Ngày"), "2026-12-31");
    await user.clear(form.getByLabelText("Khung 1 bắt đầu"));
    await user.type(form.getByLabelText("Khung 1 bắt đầu"), "08:00");
    await user.clear(form.getByLabelText("Khung 1 kết thúc"));
    await user.type(form.getByLabelText("Khung 1 kết thúc"), "11:00");
    await user.type(form.getByLabelText("Tối đa đơn"), "5");
    await user.type(form.getByLabelText("Lý do"), "Tất niên");
    await user.click(form.getByRole("button", { name: "Lưu ngày đặc biệt" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Đã lưu ngày đặc biệt 31/12/2026.");
    expect(api.bodyOf(`POST ${BASE}/PICKUP/overrides`)).toEqual({
      date: "2026-12-31",
      isClosed: false,
      intervals: [{ start: "08:00", end: "11:00" }],
      maxOrders: 5,
      maxItems: null,
      reason: "Tất niên",
    });
    expect(screen.getByRole("tab", { name: /Ngày đặc biệt\s*3/ })).toBeInTheDocument();
  });

  it("shows a window outside the opening hours on the form", async () => {
    const s = server();
    const { user } = renderAdmin(
      PATH,
      {
        ...s.handlers,
        [`POST ${BASE}/PICKUP/overrides`]: () =>
          invalid("FULFILLMENT_OUTSIDE_BRANCH_HOURS", [{ field: "intervals[0]", code: "OUTSIDE_BRANCH_HOURS" }]),
      },
      manager,
    );

    await user.click(await screen.findByRole("tab", { name: /Ngày đặc biệt/ }));
    const form = within(screen.getByRole("form", { name: "Thêm ngày đặc biệt" }));
    await user.type(form.getByLabelText("Ngày"), "2099-12-31");
    await user.click(form.getByRole("button", { name: "Lưu ngày đặc biệt" }));

    expect(await form.findByText("Khung 1 nằm ngoài giờ mở cửa.")).toBeInTheDocument();
    expect(form.getByLabelText("Khung 1 bắt đầu")).toHaveAttribute("aria-invalid", "true");
  });

  it("deletes one window of a special day and keeps unsaved weekly edits", async () => {
    const s = server();
    const { api, user } = renderAdmin(
      PATH,
      {
        ...s.handlers,
        [`DELETE ${BASE}/PICKUP/overrides/o-2`]: () => s.changeOverrides(s.schedule.overrides.filter((o) => o.overrideId !== "o-2")),
        [`PUT ${BASE}/PICKUP/weekly-schedule`]: (b) => s.replaceWeekly(b),
      },
      manager,
    );

    await loaded();
    await user.click(row("Thứ Hai").getByRole("button", { name: "Xoá khung 2 của Thứ Hai" }));
    await user.click(screen.getByRole("tab", { name: /Ngày đặc biệt/ }));
    await user.click(screen.getByRole("button", { name: "Xoá khung 14:00–18:00 ngày 24/12/2026" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Đã xoá khung 14:00–18:00 ngày 24/12/2026.");
    await user.click(screen.getByRole("tab", { name: "Lịch hàng tuần" }));
    expect(row("Thứ Hai").queryByLabelText("Thứ Hai khung 2 bắt đầu")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Lưu thay đổi" }));

    await waitFor(() => expect(ifMatchOf(api, `PUT ${BASE}/PICKUP/weekly-schedule`)).toBe('"v4"'));
  });
});

describe("Pickup schedule — preview from GET /fulfillment/capacity", () => {
  it("shows today's slots as customers see them: few left, full and past cutoff struck", async () => {
    const s = server({ isEnabled: true });
    const { api } = renderAdmin(PATH, s.handlers, manager);

    const slots = within(await screen.findByRole("list", { name: "Khung giờ khách thấy" }));
    const items = slots.getAllByRole("listitem");
    expect(items.map((li) => li.textContent)).toEqual([
      "14:00 · qua hạn chốt",
      "14:15 · còn 2 chỗ",
      "14:30 · đầy",
      "14:45",
      "15:00 · còn 3 ly",
    ]);
    expect(screen.getByRole("heading", { name: /khách thấy/ })).toBeInTheDocument();
    expect(items[0]).toHaveClass("line-through");
    expect(items[2]).toHaveClass("line-through");
    expect(items[1]).not.toHaveClass("line-through");
    const request = api.calls.find((c) => c.route === "GET /branches/b-q1/fulfillment/capacity");
    expect(request).toBeDefined();
    expect(screen.getByLabelText("Ngày xem trước")).toHaveValue(todayInBranch());
  });

  it("says customers do not see the slots while pickup is switched off (saved config)", async () => {
    const s = server({ isEnabled: false });
    renderAdmin(PATH, s.handlers, manager);

    await screen.findByRole("list", { name: "Khung giờ khách thấy" });
    expect(screen.getByText("Đang tắt nhận đơn lấy tại quầy: khách chưa thấy các khung này.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /khách thấy/ })).not.toBeInTheDocument();
  });

  it("previews another day", async () => {
    const s = server();
    const { user } = renderAdmin(PATH, s.handlers, manager);

    const date = await screen.findByLabelText("Ngày xem trước");
    await user.clear(date);
    await user.type(date, "2026-12-24");

    expect(await screen.findByRole("heading", { name: /Xem trước Thứ Năm 24\/12/ })).toBeInTheDocument();
  });
});

describe("Without FULFILLMENT_CONFIG_MANAGE", () => {
  it("does not show the screen (UI guard only)", async () => {
    const s = server();
    const barista: Me = { ...manager, branches: [{ branchId: "b-q1", roles: ["BARISTA"], permissions: ["BRANCH_VIEW"] }] };
    renderAdmin(PATH, s.handlers, barista);

    expect(await screen.findByRole("status")).toHaveTextContent("không có quyền xem màn này");
    expect(screen.queryByRole("table", { name: "Lịch nhận đơn hàng tuần" })).not.toBeInTheDocument();
  });
});
