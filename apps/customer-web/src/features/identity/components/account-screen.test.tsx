import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CustomerProviders } from "../../../lib/customer-api";
import { AccountScreen } from "./account-screen";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push: replace, refresh: vi.fn() }) }));

type Answer = (request: Request) => Response | Promise<Response>;

function serve(answers: Record<string, Answer | Answer[]>) {
  const calls: { route: string; body: string; ifMatch: string | null }[] = [];
  const queues = new Map(Object.entries(answers).map(([k, v]) => [k, Array.isArray(v) ? [...v] : v]));
  vi.stubGlobal(
    "fetch",
    vi.fn(async (request: Request) => {
      const route = `${request.method} ${new URL(request.url).pathname.replace("/api/customer/v1", "")}`;
      calls.push({ route, body: await request.clone().text(), ifMatch: request.headers.get("If-Match") });
      const answer = queues.get(route);
      const next = Array.isArray(answer) ? (answer.length > 1 ? answer.shift() : answer[0]) : answer;
      return next ? next(request) : Response.json({ status: 404, code: "NOT_FOUND" }, { status: 404 });
    }),
  );
  return calls;
}

const problem = (status: number, code: string) =>
  Response.json({ status, code }, { status, headers: { "Content-Type": "application/problem+json" } });
const me = () => Response.json({ userId: "u", customerId: "c", displayName: "Ngọc Hà", phoneMasked: "+8490*****567" });
const profile = (displayName: string, version: number) => () =>
  Response.json({ customerId: "c", displayName, phoneMasked: "+8490*****567", loyalty: null }, { headers: { ETag: `"${version}"` } });
const unauthenticated = () => problem(401, "AUTH_REQUIRED");

function renderAccount() {
  const user = userEvent.setup();
  render(
    <CustomerProviders>
      <AccountScreen />
    </CustomerProviders>,
  );
  return user;
}

afterEach(() => {
  vi.unstubAllGlobals();
  replace.mockReset();
});

describe("Account (D3f screen 11, FE #72)", () => {
  it("sends a signed-out Customer to sign-in and back here, after one refresh attempt", async () => {
    const calls = serve({ "GET /auth/me": unauthenticated, "POST /auth/refresh": unauthenticated, "GET /me/profile": unauthenticated });
    renderAccount();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login?next=%2Faccount"));
    expect(calls.map((c) => c.route).slice(0, 2)).toEqual(["GET /auth/me", "POST /auth/refresh"]);
  });

  it("shows the profile: name, masked phone, what the phone is for", async () => {
    serve({ "GET /auth/me": me, "GET /me/profile": profile("Ngọc Hà", 3) });
    renderAccount();
    expect(await screen.findByRole("heading", { level: 1, name: "Tài khoản" })).toBeInTheDocument();
    const card = within(await screen.findByRole("region", { name: "Hồ sơ" }));
    expect(await card.findByText("Ngọc Hà")).toBeInTheDocument();
    expect(card.getByText("+8490*****567")).toBeInTheDocument();
    expect(card.getByText("Số điện thoại này dùng để đăng nhập.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Đổi mật khẩu" })).toHaveAttribute("href", "/account/password");
    expect(screen.getByRole("region", { name: "Thiết bị đang đăng nhập" })).toBeInTheDocument();
  });

  it("renames with If-Match from the ETag and shows the new name", async () => {
    const calls = serve({
      "GET /auth/me": me,
      "GET /me/profile": [profile("Ngọc Hà", 3), profile("Hà", 4)],
      "PATCH /me/profile": profile("Hà", 4),
    });
    const user = renderAccount();
    const card = within(await screen.findByRole("region", { name: "Hồ sơ" }));
    await user.click(await card.findByRole("button", { name: "Sửa tên" }));
    const name = card.getByLabelText("Tên hiển thị");
    expect(name).toHaveValue("Ngọc Hà");
    expect(name).toHaveFocus();
    await user.clear(name);
    await user.type(name, " Hà ");
    await user.click(card.getByRole("button", { name: "Lưu" }));

    expect(await card.findByText("Hà")).toBeInTheDocument();
    expect(await screen.findByRole("status")).toHaveTextContent("Đã lưu tên.");
    const patch = calls.find((c) => c.route === "PATCH /me/profile")!;
    expect(JSON.parse(patch.body)).toEqual({ displayName: "Hà" });
    expect(patch.ifMatch).toBe('"3"');
  });

  it("checks an empty name here", async () => {
    const calls = serve({ "GET /auth/me": me, "GET /me/profile": profile("Ngọc Hà", 3) });
    const user = renderAccount();
    const card = within(await screen.findByRole("region", { name: "Hồ sơ" }));
    await user.click(await card.findByRole("button", { name: "Sửa tên" }));
    await user.clear(card.getByLabelText("Tên hiển thị"));
    await user.click(card.getByRole("button", { name: "Lưu" }));
    expect(card.getByText("Nhập tên hiển thị.")).toBeInTheDocument();
    expect(calls.some((c) => c.route === "PATCH /me/profile")).toBe(false);
  });

  it("on 412 reloads the profile, keeps the typed name and saves against the new version", async () => {
    const calls = serve({
      "GET /auth/me": me,
      "GET /me/profile": [profile("Ngọc Hà", 3), profile("Hà Ngọc", 5)],
      "PATCH /me/profile": [() => problem(412, "VERSION_CONFLICT"), profile("Hà", 6)],
    });
    const user = renderAccount();
    const card = within(await screen.findByRole("region", { name: "Hồ sơ" }));
    await user.click(await card.findByRole("button", { name: "Sửa tên" }));
    await user.clear(card.getByLabelText("Tên hiển thị"));
    await user.type(card.getByLabelText("Tên hiển thị"), "Hà");
    await user.click(card.getByRole("button", { name: "Lưu" }));

    expect(await card.findByRole("alert")).toHaveTextContent("Tên vừa được đổi ở nơi khác (hiện là “Hà Ngọc”). Bấm Lưu để dùng tên bạn vừa nhập.");
    expect(card.getByLabelText("Tên hiển thị")).toHaveValue("Hà");
    await user.click(card.getByRole("button", { name: "Lưu" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Đã lưu tên.");
    expect(calls.filter((c) => c.route === "PATCH /me/profile").map((c) => c.ifMatch)).toEqual(['"3"', '"5"']);
  });

  it("cancels the edit without saving", async () => {
    const calls = serve({ "GET /auth/me": me, "GET /me/profile": profile("Ngọc Hà", 3) });
    const user = renderAccount();
    const card = within(await screen.findByRole("region", { name: "Hồ sơ" }));
    await user.click(await card.findByRole("button", { name: "Sửa tên" }));
    await user.click(card.getByRole("button", { name: "Huỷ" }));
    await waitFor(() => expect(card.getByRole("button", { name: "Sửa tên" })).toHaveFocus());
    expect(calls.some((c) => c.route === "PATCH /me/profile")).toBe(false);
  });

  it("signs out and goes home", async () => {
    const calls = serve({ "GET /auth/me": me, "GET /me/profile": profile("Ngọc Hà", 3), "POST /auth/logout": () => new Response(null, { status: 204 }) });
    const user = renderAccount();
    await user.click(await screen.findByRole("button", { name: "Đăng xuất" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
    expect(calls.map((c) => c.route)).toContain("POST /auth/logout");
  });

  it("stays signed in and says so when the sign-out request fails", async () => {
    serve({ "GET /auth/me": me, "GET /me/profile": profile("Ngọc Hà", 3), "POST /auth/logout": () => problem(503, "SERVICE_UNAVAILABLE") });
    const user = renderAccount();
    await user.click(await screen.findByRole("button", { name: "Đăng xuất" }));
    expect(await screen.findByText(/Chưa đăng xuất được/)).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("counts a 401 on sign-out as signed out", async () => {
    serve({
      "GET /auth/me": me,
      "GET /me/profile": profile("Ngọc Hà", 3),
      "POST /auth/logout": unauthenticated,
      "POST /auth/refresh": unauthenticated,
    });
    const user = renderAccount();
    await user.click(await screen.findByRole("button", { name: "Đăng xuất" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
    expect(replace).not.toHaveBeenCalledWith("/login?next=%2Faccount");
  });
});

describe("Account — load and save failures (FE #72 review)", () => {
  it("offers Thử lại when the profile cannot be loaded", async () => {
    serve({ "GET /auth/me": me, "GET /me/profile": [() => problem(503, "SERVICE_UNAVAILABLE"), profile("Ngọc Hà", 3)] });
    const user = renderAccount();
    const card = within(await screen.findByRole("region", { name: "Hồ sơ" }));
    expect(await card.findByText("Chưa tải được hồ sơ.")).toBeInTheDocument();
    await user.click(card.getByRole("button", { name: "Thử lại" }));
    expect(await card.findByText("Ngọc Hà")).toBeInTheDocument();
  });

  it("keeps the open edit when reloading after a 412 fails", async () => {
    serve({
      "GET /auth/me": me,
      "GET /me/profile": [profile("Ngọc Hà", 3), () => problem(503, "SERVICE_UNAVAILABLE")],
      "PATCH /me/profile": () => problem(412, "VERSION_CONFLICT"),
    });
    const user = renderAccount();
    const card = within(await screen.findByRole("region", { name: "Hồ sơ" }));
    await user.click(await card.findByRole("button", { name: "Sửa tên" }));
    await user.clear(card.getByLabelText("Tên hiển thị"));
    await user.type(card.getByLabelText("Tên hiển thị"), "Hà");
    await user.click(card.getByRole("button", { name: "Lưu" }));
    expect(await card.findByText("Chưa tải lại được hồ sơ. Bạn thử lại sau ít phút nhé.")).toBeInTheDocument();
    expect(card.getByLabelText("Tên hiển thị")).toHaveValue("Hà");
  });

  it("puts a 400 under the name field", async () => {
    serve({ "GET /auth/me": me, "GET /me/profile": profile("Ngọc Hà", 3), "PATCH /me/profile": () => problem(400, "VALIDATION_FAILED") });
    const user = renderAccount();
    const card = within(await screen.findByRole("region", { name: "Hồ sơ" }));
    await user.click(await card.findByRole("button", { name: "Sửa tên" }));
    await user.click(card.getByRole("button", { name: "Lưu" }));
    expect(await card.findByText("Tên này chưa hợp lệ. Dùng 1–128 ký tự.")).toBeInTheDocument();
    expect(card.getByLabelText("Tên hiển thị")).toHaveAttribute("aria-invalid", "true");
  });

  it("uses the whole first character for the avatar", async () => {
    serve({ "GET /auth/me": me, "GET /me/profile": profile("🍵 Trà", 3) });
    renderAccount();
    const card = within(await screen.findByRole("region", { name: "Hồ sơ" }));
    expect(await card.findByText("🍵")).toBeInTheDocument();
  });
});

describe("Account — after changing the password (FE #73)", () => {
  it("says the other devices were signed out", async () => {
    serve({ "GET /auth/me": me, "GET /me/profile": profile("Ngọc Hà", 3) });
    render(
      <CustomerProviders>
        <AccountScreen passwordChanged />
      </CustomerProviders>,
    );
    expect(await screen.findByText("Đã đổi mật khẩu. Các thiết bị khác đã được đăng xuất.")).toBeInTheDocument();
    // Shown once: the URL drops ?password=changed so a reload does not show it again (#88 review).
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/account"));
  });
});
