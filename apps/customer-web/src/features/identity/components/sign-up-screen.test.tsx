import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CustomerProviders } from "../../../lib/customer-api";
import { SignUpScreen } from "./sign-up-screen";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }) }));

type Answer = (body: unknown) => Response;

function serve(answers: Record<string, Answer | Answer[]>) {
  const calls: { route: string; body: unknown }[] = [];
  const queues = new Map(Object.entries(answers).map(([k, v]) => [k, Array.isArray(v) ? [...v] : v]));
  vi.stubGlobal(
    "fetch",
    vi.fn(async (request: Request) => {
      const route = `${request.method} ${new URL(request.url).pathname.replace("/api/customer/v1", "")}`;
      const text = await request.clone().text();
      const body: unknown = text ? JSON.parse(text) : undefined;
      calls.push({ route, body });
      const answer = queues.get(route);
      const next = Array.isArray(answer) ? (answer.length > 1 ? answer.shift() : answer[0]) : answer;
      return next ? next(body) : Response.json({ status: 404, code: "NOT_FOUND" }, { status: 404 });
    }),
  );
  return calls;
}

const problem = (status: number, code: string, headers: Record<string, string> = {}) =>
  Response.json({ status, code }, { status, headers: { "Content-Type": "application/problem+json", ...headers } });
const sent = (resendAfterSeconds = 60) => () =>
  Response.json({ challengeId: "ch-1", expiresAt: "2026-11-22T03:05:00Z", resendAfterSeconds }, { status: 202 });
const verified = () => Response.json({ verificationToken: "vt-1", expiresAt: "2026-11-22T03:10:00Z" });

function renderSignUp(fakeTimers = false) {
  const user = userEvent.setup(fakeTimers ? { advanceTimers: vi.advanceTimersByTime.bind(vi) } : {});
  render(
    <CustomerProviders>
      <SignUpScreen />
    </CustomerProviders>,
  );
  return user;
}

async function toCodeStep(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Số điện thoại"), "0901 234 567");
  await user.click(screen.getByRole("button", { name: "Gửi mã" }));
  await screen.findByRole("heading", { level: 1, name: "Nhập mã xác minh" });
}

async function toDetailsStep(user: ReturnType<typeof userEvent.setup>) {
  await toCodeStep(user);
  await user.type(screen.getByLabelText("Mã xác minh"), "582104");
  await user.click(screen.getByRole("button", { name: "Xác minh" }));
  await screen.findByRole("heading", { level: 1, name: /Hoàn tất tài khoản|Số này đã có tài khoản/ });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("Customer sign-up with OTP (D3a screen 8, D3f 8b/8c, FE #71)", () => {
  it("sends a code, verifies it, creates the account, then asks to sign in with the phone filled in", async () => {
    const calls = serve({
      "POST /auth/otp": sent(),
      "POST /auth/otp/verify": verified,
      "POST /auth/register": () => Response.json({ customerId: "c-1" }, { status: 201 }),
    });
    const user = renderSignUp();
    expect(screen.getByRole("heading", { level: 1, name: "Tạo tài khoản" })).toBeInTheDocument();
    expect(screen.getByText("Bước 1/3")).toBeInTheDocument();

    await toCodeStep(user);
    expect(screen.getByText("Bước 2/3")).toBeInTheDocument();
    expect(screen.getByText("0901 ••• 567")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Mã xác minh"), "582104");
    await user.click(screen.getByRole("button", { name: "Xác minh" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Hoàn tất tài khoản" })).toBeInTheDocument();
    await user.type(screen.getByLabelText("Tên hiển thị"), "Ngọc Hà");
    await user.type(screen.getByLabelText("Mật khẩu"), "tra sua matcha");
    await user.click(screen.getByRole("button", { name: "Tạo tài khoản" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Chào bạn trở lại" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Đã tạo tài khoản. Đăng nhập bằng số điện thoại và mật khẩu vừa đặt.");
    expect(screen.getByLabelText("Số điện thoại")).toHaveValue("0901234567");
    expect(calls.map((c) => [c.route, c.body])).toEqual([
      ["POST /auth/otp", { phone: "0901234567", purpose: "REGISTRATION" }],
      ["POST /auth/otp/verify", { challengeId: "ch-1", code: "582104" }],
      ["POST /auth/register", { verificationToken: "vt-1", displayName: "Ngọc Hà", password: "tra sua matcha" }],
    ]);
  });

  it("counts the wrong codes left, then offers a new code once the challenge is locked", async () => {
    const calls = serve({
      "POST /auth/otp": sent(),
      "POST /auth/otp/verify": [() => problem(401, "OTP_CODE_INVALID"), () => problem(401, "OTP_CODE_INVALID"), () => problem(401, "OTP_CHALLENGE_LOCKED")],
    });
    const user = renderSignUp();
    await toCodeStep(user);
    const code = screen.getByLabelText("Mã xác minh");
    await user.type(code, "111111");
    await user.click(screen.getByRole("button", { name: "Xác minh" }));
    expect(await screen.findByText("Mã chưa đúng. Bạn còn 4 lần thử.")).toBeInTheDocument();
    expect(code).toHaveAttribute("aria-invalid", "true");
    await user.clear(code);
    await user.type(code, "222222");
    await user.click(screen.getByRole("button", { name: "Xác minh" }));
    expect(await screen.findByText("Mã chưa đúng. Bạn còn 3 lần thử.")).toBeInTheDocument();
    await user.clear(code);
    await user.type(code, "333333");
    await user.click(screen.getByRole("button", { name: "Xác minh" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Mã đã hết hạn hoặc nhập sai quá 5 lần");
    await user.click(screen.getByRole("button", { name: "Gửi mã mới" }));
    await waitFor(() => expect(calls.filter((c) => c.route === "POST /auth/otp")).toHaveLength(2));
    expect(await screen.findByLabelText("Mã xác minh")).toHaveValue("");
  });

  it("lets the code be sent again only after resendAfterSeconds", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const calls = serve({ "POST /auth/otp": sent(60) });
    const user = renderSignUp(true);
    await toCodeStep(user);
    expect(screen.getByRole("button", { name: /Gửi lại mã sau 1:00/ })).toBeDisabled();
    act(() => {
      vi.advanceTimersByTime(18_000);
    });
    expect(screen.getByRole("button", { name: /Gửi lại mã sau 0:42/ })).toBeDisabled();
    act(() => {
      vi.advanceTimersByTime(42_000);
    });
    await user.click(screen.getByRole("button", { name: "Gửi lại mã" }));
    await waitFor(() => expect(calls.filter((c) => c.route === "POST /auth/otp")).toHaveLength(2));
  });

  it("says when more codes can be asked for after RATE_LIMITED", async () => {
    serve({ "POST /auth/otp": () => problem(429, "RATE_LIMITED", { "Retry-After": "700" }) });
    const user = renderSignUp();
    await user.type(screen.getByLabelText("Số điện thoại"), "0901234567");
    await user.click(screen.getByRole("button", { name: "Gửi mã" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Bạn đã yêu cầu quá nhiều mã");
    expect(alert).toHaveTextContent("Thử lại sau 12 phút. Mỗi số nhận tối đa 5 mã mỗi giờ.");
    expect(screen.getByRole("link", { name: "Xem menu trước" })).toHaveAttribute("href", "/");
  });

  it("puts a weak password under the password field (AUTH_PASSWORD_POLICY_VIOLATION)", async () => {
    serve({ "POST /auth/otp": sent(), "POST /auth/otp/verify": verified, "POST /auth/register": () => problem(422, "AUTH_PASSWORD_POLICY_VIOLATION") });
    const user = renderSignUp();
    await toDetailsStep(user);
    await user.type(screen.getByLabelText("Tên hiển thị"), "Hà");
    await user.type(screen.getByLabelText("Mật khẩu"), "12345678");
    await user.click(screen.getByRole("button", { name: "Tạo tài khoản" }));
    expect(await screen.findByText("Mật khẩu này dễ đoán. Chọn mật khẩu khác.")).toBeInTheDocument();
    expect(screen.getByLabelText("Mật khẩu")).toHaveAttribute("aria-invalid", "true");
  });

  it("checks a short password here", async () => {
    const calls = serve({ "POST /auth/otp": sent(), "POST /auth/otp/verify": verified });
    const user = renderSignUp();
    await toDetailsStep(user);
    await user.type(screen.getByLabelText("Tên hiển thị"), "Hà");
    await user.type(screen.getByLabelText("Mật khẩu"), "hayi123");
    await user.click(screen.getByRole("button", { name: "Tạo tài khoản" }));
    expect(screen.getByText("Mật khẩu cần ít nhất 8 ký tự.")).toBeInTheDocument();
    expect(calls.some((c) => c.route === "POST /auth/register")).toBe(false);
  });

  it("asks a Staff member's phone for the current password; a wrong one needs a new code", async () => {
    const calls = serve({
      "POST /auth/otp": sent(),
      "POST /auth/otp/verify": verified,
      "POST /auth/register": [() => problem(422, "AUTH_CURRENT_PASSWORD_REQUIRED"), () => problem(401, "AUTH_INVALID_CREDENTIALS")],
    });
    const user = renderSignUp();
    await toDetailsStep(user);
    await user.type(screen.getByLabelText("Tên hiển thị"), "Minh");
    await user.type(screen.getByLabelText("Mật khẩu"), "mat khau moi 1");
    await user.click(screen.getByRole("button", { name: "Tạo tài khoản" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Số này đã có tài khoản" })).toBeInTheDocument();
    expect(screen.getByLabelText("Tên hiển thị")).toHaveValue("Minh");
    await user.type(screen.getByLabelText("Mật khẩu hiện có"), "sai");
    await user.click(screen.getByRole("button", { name: "Xác nhận" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Mật khẩu hiện có chưa đúng. Gửi mã mới để thử lại.");
    expect(calls.at(-1)).toEqual({ route: "POST /auth/register", body: { verificationToken: "vt-1", displayName: "Minh", currentPassword: "sai" } });
    await user.click(screen.getByRole("button", { name: "Gửi mã mới" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Nhập mã xác minh" })).toBeInTheDocument();
  });

  it("invites an existing Customer to sign in (CUSTOMER_ALREADY_REGISTERED)", async () => {
    serve({ "POST /auth/otp": sent(), "POST /auth/otp/verify": verified, "POST /auth/register": () => problem(409, "CUSTOMER_ALREADY_REGISTERED") });
    const user = renderSignUp();
    await toDetailsStep(user);
    await user.type(screen.getByLabelText("Tên hiển thị"), "Hà");
    await user.type(screen.getByLabelText("Mật khẩu"), "tra sua matcha");
    await user.click(screen.getByRole("button", { name: "Tạo tài khoản" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Số này đã có tài khoản đặt món.");
    await user.click(within(alert).getByRole("button", { name: "Đăng nhập" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Chào bạn trở lại" })).toBeInTheDocument();
    expect(screen.getByLabelText("Số điện thoại")).toHaveValue("0901234567");
  });
});
