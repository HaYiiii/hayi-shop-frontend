import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CustomerProviders } from "../../../lib/customer-api";
import { DevicesCard } from "./devices-card";

type Answer = () => Response;

function serve(answers: Record<string, Answer | Answer[]>) {
  const routes: string[] = [];
  const queues = new Map(Object.entries(answers).map(([k, v]) => [k, Array.isArray(v) ? [...v] : v]));
  vi.stubGlobal(
    "fetch",
    vi.fn((request: Request) => {
      const route = `${request.method} ${new URL(request.url).pathname.replace("/api/customer/v1", "")}`;
      routes.push(route);
      const answer = queues.get(route);
      const next = Array.isArray(answer) ? (answer.length > 1 ? answer.shift() : answer[0]) : answer;
      return Promise.resolve(next ? next() : Response.json({ status: 404, code: "NOT_FOUND" }, { status: 404 }));
    }),
  );
  return routes;
}

const problem = (status: number, code: string) =>
  Response.json({ status, code }, { status, headers: { "Content-Type": "application/problem+json" } });
const session = (sessionId: string, userAgent: string, lastActiveAt: string, current = false) => ({
  sessionId,
  userAgent,
  ipAddress: "203.0.113.7",
  createdAt: "2026-11-01T03:00:00Z",
  lastActiveAt,
  current,
});
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1";
const MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const both = () =>
  Response.json({ items: [session("s-this", IPHONE, "2026-11-26T03:00:00Z", true), session("s-mac", MAC, "2026-11-18T14:04:00Z")] });
const onlyThis = () => Response.json({ items: [session("s-this", IPHONE, "2026-11-26T03:00:00Z", true)] });

function renderCard() {
  const user = userEvent.setup();
  render(
    <CustomerProviders>
      <DevicesCard />
    </CustomerProviders>,
  );
  return user;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Devices signed in (D3f screen 11, FE #74)", () => {
  it("lists this device first as in use, and others with their last use in Branch time, without IP addresses", async () => {
    serve({ "GET /auth/sessions": both });
    renderCard();
    const card = within(await screen.findByRole("region", { name: "Thiết bị đang đăng nhập" }));
    const rows = await card.findAllByRole("listitem");
    expect(rows.map((r) => r.textContent)).toEqual([
      expect.stringContaining("iPhone · Safari"),
      expect.stringContaining("Mac · Chrome"),
    ]);
    expect(within(rows[0]!).getByText("Đang dùng")).toBeInTheDocument();
    expect(within(rows[0]!).getByText("Thiết bị này")).toBeInTheDocument();
    expect(within(rows[0]!).queryByRole("button")).not.toBeInTheDocument();
    // 14:04 UTC is 21:04 in Asia/Ho_Chi_Minh.
    expect(within(rows[1]!).getByText("Dùng lần cuối 18/11, 21:04")).toBeInTheDocument();
    expect(card.queryByText(/203\.0\.113\.7/)).not.toBeInTheDocument();
  });

  it("signs another device out after confirming, then shows the new list", async () => {
    const routes = serve({ "GET /auth/sessions": [both, onlyThis], "DELETE /auth/sessions/s-mac": () => new Response(null, { status: 204 }) });
    const user = renderCard();
    const card = within(await screen.findByRole("region", { name: "Thiết bị đang đăng nhập" }));
    await user.click(await card.findByRole("button", { name: "Đăng xuất Mac · Chrome" }));

    const dialog = within(await screen.findByRole("dialog", { name: "Đăng xuất Mac · Chrome?" }));
    await user.click(dialog.getByRole("button", { name: "Đăng xuất" }));

    await waitFor(() => expect(card.queryByText("Mac · Chrome")).not.toBeInTheDocument());
    expect(await card.findByRole("status")).toHaveTextContent("Đã đăng xuất Mac · Chrome.");
    expect(routes).toEqual(["GET /auth/sessions", "DELETE /auth/sessions/s-mac", "GET /auth/sessions"]);
  });

  it("cancels without signing the device out", async () => {
    const routes = serve({ "GET /auth/sessions": both });
    const user = renderCard();
    const card = within(await screen.findByRole("region", { name: "Thiết bị đang đăng nhập" }));
    await user.click(await card.findByRole("button", { name: "Đăng xuất Mac · Chrome" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Huỷ" }));
    expect(routes).toEqual(["GET /auth/sessions"]);
  });

  it("says a device already signed out (SESSION_NOT_FOUND) and reloads the list", async () => {
    const routes = serve({ "GET /auth/sessions": [both, onlyThis], "DELETE /auth/sessions/s-mac": () => problem(404, "SESSION_NOT_FOUND") });
    const user = renderCard();
    const card = within(await screen.findByRole("region", { name: "Thiết bị đang đăng nhập" }));
    await user.click(await card.findByRole("button", { name: "Đăng xuất Mac · Chrome" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Đăng xuất" }));
    expect(await card.findByRole("status")).toHaveTextContent("Mac · Chrome đã đăng xuất trước đó.");
    await waitFor(() => expect(routes.filter((r) => r === "GET /auth/sessions")).toHaveLength(2));
  });

  it("offers Thử lại when the list cannot be loaded", async () => {
    serve({ "GET /auth/sessions": [() => problem(503, "SERVICE_UNAVAILABLE"), onlyThis] });
    const user = renderCard();
    const card = within(await screen.findByRole("region", { name: "Thiết bị đang đăng nhập" }));
    expect(await card.findByText("Chưa tải được danh sách thiết bị.")).toBeInTheDocument();
    await user.click(card.getByRole("button", { name: "Thử lại" }));
    expect(await card.findByText("iPhone · Safari")).toBeInTheDocument();
  });
});
