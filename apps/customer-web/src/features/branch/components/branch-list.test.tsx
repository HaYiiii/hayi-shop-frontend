import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import type { PublicBranch } from "../api/branches";
import { BranchList, BranchListError } from "./branch-list";

function aBranch(overrides: Partial<PublicBranch>): PublicBranch {
  return {
    branchId: "0192-q1",
    branchCode: "Q1-LELOI",
    name: "Quận 1 · Lê Lợi",
    address: { line: "68 Lê Lợi", ward: "Bến Nghé", district: "Quận 1", province: "TP.HCM" },
    location: null,
    phone: null,
    timezone: "Asia/Ho_Chi_Minh",
    openNow: true,
    todayHours: [{ open: "07:00", close: "22:00" }],
    fulfillmentTypes: ["PICKUP"],
    earliestPickupAt: "2026-11-05T08:00:00Z",
    ...overrides,
  };
}

const branches = [
  aBranch({}),
  aBranch({
    branchId: "0192-td",
    branchCode: "TD-VOVANNGAN",
    name: "Thủ Đức · Võ Văn Ngân",
    address: { line: "25 Võ Văn Ngân", ward: "Linh Chiểu", district: null, province: "TP.HCM" },
    openNow: false,
    earliestPickupAt: "2026-11-05T17:30:00Z",
  }),
];

// 10:00 on 5 Nov in Ho Chi Minh City.
const now = new Date("2026-11-05T03:00:00Z");

function card(name: string) {
  return within(screen.getByRole("link", { name: new RegExp(name) }));
}

afterEach(() => {
  document.cookie = "hayi.branch=; path=/; max-age=0";
});

describe("BranchList — D3a screen 1", () => {
  it("shows each Branch with its address, whether it is open now and when to pick up", () => {
    render(<BranchList branches={branches} now={now} />);

    const q1 = card("Quận 1 · Lê Lợi");
    expect(q1.getByText("Đang mở")).toBeInTheDocument();
    expect(q1.getByText("68 Lê Lợi, Bến Nghé, Quận 1")).toBeInTheDocument();
    expect(q1.getByText("Lấy sớm nhất 15:00 hôm nay")).toBeInTheDocument();

    const td = card("Thủ Đức · Võ Văn Ngân");
    expect(td.getByText("Tạm đóng")).toBeInTheDocument();
    expect(td.getByText("25 Võ Văn Ngân, Linh Chiểu")).toBeInTheDocument();
    expect(td.getByText("Hôm nay hết nhận đơn · đặt trước cho ngày mai")).toBeInTheDocument();
  });

  it("leads to the Branch's menu by its code", () => {
    render(<BranchList branches={branches} now={now} />);

    expect(screen.getByRole("link", { name: /Quận 1 · Lê Lợi/ })).toHaveAttribute("href", "/b/Q1-LELOI/menu");
  });

  it("remembers the chosen Branch as a UI preference cookie", async () => {
    const user = userEvent.setup();
    render(<BranchList branches={branches} now={now} />);

    await user.click(screen.getByRole("link", { name: /Thủ Đức/ }));

    expect(document.cookie).toContain("hayi.branch=TD-VOVANNGAN");
  });

  it("says so when no Branch takes orders", () => {
    render(<BranchList branches={[]} now={now} />);

    expect(screen.getByText("Hiện chưa có chi nhánh nào nhận đặt trước. Bạn quay lại sau nhé.")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });
});

describe("BranchListError — by Problem code", () => {
  it.each([
    ["RATE_LIMITED", "Bạn tải lại hơi nhanh. Chờ một chút rồi thử lại."],
    ["SERVICE_UNAVAILABLE", "Chưa tải được danh sách chi nhánh. Kiểm tra mạng rồi thử lại."],
    ["NETWORK_ERROR", "Chưa tải được danh sách chi nhánh. Kiểm tra mạng rồi thử lại."],
  ])("explains %s and offers to try again", (code, text) => {
    render(<BranchListError code={code} />);

    expect(screen.getByRole("alert")).toHaveTextContent(text);
    expect(screen.getByRole("link", { name: "Thử lại" })).toHaveAttribute("href", "/");
  });
});
