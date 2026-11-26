import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CustomerProviders } from "../../../lib/customer-api";
import { ChangePasswordScreen } from "./change-password-screen";
import { ForgotPasswordScreen } from "./forgot-password-screen";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push: replace, refresh: vi.fn() }) }));

type Answer = () => Response;

function serve(answers: Record<string, Answer | Answer[]>) {
  const calls: { route: string; body: unknown }[] = [];
  const queues = new Map(Object.entries(answers).map(([k, v]) => [k, Array.isArray(v) ? [...v] : v]));
  vi.stubGlobal(
    "fetch",
    vi.fn(async (request: Request) => {
      const route = `${request.method} ${new URL(request.url).pathname.replace("/api/customer/v1", "")}`;
      const text = await request.clone().text();
      calls.push({ route, body: text ? (JSON.parse(text) as unknown) : undefined });
      const answer = queues.get(route);
      const next = Array.isArray(answer) ? (answer.length > 1 ? answer.shift() : answer[0]) : answer;
      return next ? next() : Response.json({ status: 404, code: "NOT_FOUND" }, { status: 404 });
    }),
  );
  return calls;
}

const problem = (status: number, code: string, headers: Record<string, string> = {}) =>
  Response.json({ status, code }, { status, headers: { "Content-Type": "application/problem+json", ...headers } });
const sent = () => Response.json({ challengeId: "ch-1", expiresAt: "2026-11-25T03:05:00Z", resendAfterSeconds: 60 }, { status: 202 });
const verified = () => Response.json({ verificationToken: "vt-r", expiresAt: "2026-11-25T03:10:00Z" });
const noContent = () => new Response(null, { status: 204 });
const me = () => Response.json({ userId: "u", customerId: "c", displayName: "Lan", phoneMasked: "+8490*****567" });

function renderIn(node: React.ReactNode) {
  const user = userEvent.setup();
  render(<CustomerProviders>{node}</CustomerProviders>);
  return user;
}

async function toNewPassword(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Số điện thoại"), "0901 234 567");
  await user.click(screen.getByRole("button", { name: "Gửi mã" }));
  await user.type(await screen.findByLabelText("Mã xác minh"), "582104");
  await user.click(screen.getByRole("button", { name: "Xác minh" }));
  await screen.findByRole("heading", { level: 1, name: "Đặt mật khẩu mới" });
}

afterEach(() => {
  vi.unstubAllGlobals();
  replace.mockReset();
});

describe("Forgot password (D3f 8d, FE #73)", () => {
  it("sends a recovery code, verifies it, sets the new password, then offers sign-in", async () => {
    const calls = serve({ "POST /auth/otp": sent, "POST /auth/otp/verify": verified, "POST /auth/password/reset": noContent });
    const user = renderIn(<ForgotPasswordScreen />);
    expect(screen.getByRole("heading", { level: 1, name: "Quên mật khẩu" })).toBeInTheDocument();
    expect(screen.getByText("Bước 1/3")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Quay lại đăng nhập" })).toHaveAttribute("href", "/login");

    await toNewPassword(user);
    expect(screen.getByText("Bước 3/3")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Mật khẩu mới"), "tra sua matcha 2");
    await user.click(screen.getByRole("button", { name: "Lưu mật khẩu" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Đã đổi mật khẩu" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Đăng nhập" })).toHaveAttribute("href", "/login");
    expect(calls.map((c) => [c.route, c.body])).toEqual([
      ["POST /auth/otp", { phone: "0901234567", purpose: "PASSWORD_RECOVERY" }],
      ["POST /auth/otp/verify", { challengeId: "ch-1", code: "582104" }],
      ["POST /auth/password/reset", { verificationToken: "vt-r", newPassword: "tra sua matcha 2" }],
    ]);
  });

  it("checks a short new password here and shows the policy answer under the field", async () => {
    const calls = serve({ "POST /auth/otp": sent, "POST /auth/otp/verify": verified, "POST /auth/password/reset": () => problem(422, "AUTH_PASSWORD_POLICY_VIOLATION") });
    const user = renderIn(<ForgotPasswordScreen />);
    await toNewPassword(user);
    await user.type(screen.getByLabelText("Mật khẩu mới"), "ngan");
    await user.click(screen.getByRole("button", { name: "Lưu mật khẩu" }));
    expect(screen.getByText("Mật khẩu cần ít nhất 8 ký tự.")).toBeInTheDocument();
    expect(calls.some((c) => c.route === "POST /auth/password/reset")).toBe(false);

    await user.clear(screen.getByLabelText("Mật khẩu mới"));
    await user.type(screen.getByLabelText("Mật khẩu mới"), "12345678");
    await user.click(screen.getByRole("button", { name: "Lưu mật khẩu" }));
    expect(await screen.findByText(/Mật khẩu này chưa đạt yêu cầu/)).toBeInTheDocument();
    expect(screen.getByLabelText("Mật khẩu mới")).toHaveAttribute("aria-invalid", "true");
  });

  it("asks for a new code when the proof is no longer valid (VERIFICATION_TOKEN_INVALID)", async () => {
    const calls = serve({ "POST /auth/otp": sent, "POST /auth/otp/verify": verified, "POST /auth/password/reset": () => problem(401, "VERIFICATION_TOKEN_INVALID") });
    const user = renderIn(<ForgotPasswordScreen />);
    await toNewPassword(user);
    await user.type(screen.getByLabelText("Mật khẩu mới"), "tra sua matcha 2");
    await user.click(screen.getByRole("button", { name: "Lưu mật khẩu" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Phiên xác minh đã hết hạn.");
    await user.click(screen.getByRole("button", { name: "Gửi mã mới" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Nhập mã xác minh" })).toBeInTheDocument();
    expect(calls.filter((c) => c.route === "POST /auth/otp")).toHaveLength(2);
  });
});

describe("Forgot password — network (FE #73 review)", () => {
  it("says the server could not be reached when the reset request fails to send", async () => {
    serve({ "POST /auth/otp": sent, "POST /auth/otp/verify": verified, "POST /auth/password/reset": () => { throw new TypeError("Failed to fetch"); } });
    const user = renderIn(<ForgotPasswordScreen />);
    await toNewPassword(user);
    await user.type(screen.getByLabelText("Mật khẩu mới"), "tra sua matcha 2");
    await user.click(screen.getByRole("button", { name: "Lưu mật khẩu" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.");
  });
});

describe("Change password (D3f screen 12, FE #73)", () => {
  async function fill(user: ReturnType<typeof userEvent.setup>, current: string, next: string) {
    await user.type(await screen.findByLabelText("Mật khẩu hiện tại"), current);
    await user.type(screen.getByLabelText("Mật khẩu mới"), next);
    await user.click(screen.getByRole("button", { name: "Lưu mật khẩu" }));
  }

  it("changes the password and goes back to the account with a notice", async () => {
    const calls = serve({ "GET /auth/me": me, "POST /auth/password/change": noContent });
    const user = renderIn(<ChangePasswordScreen />);
    expect(await screen.findByRole("heading", { level: 1, name: "Đổi mật khẩu" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Quay lại tài khoản" })).toHaveAttribute("href", "/account");
    expect(screen.getByRole("link", { name: "Quên mật khẩu hiện tại?" })).toHaveAttribute("href", "/forgot-password");
    await fill(user, "mat khau cu 1", "mat khau moi 2");
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/account?password=changed"));
    expect(calls.find((c) => c.route === "POST /auth/password/change")?.body).toEqual({ currentPassword: "mat khau cu 1", newPassword: "mat khau moi 2" });
  });

  it("puts a wrong current password under that field (AUTH_INVALID_CREDENTIALS)", async () => {
    serve({ "GET /auth/me": me, "POST /auth/password/change": () => problem(401, "AUTH_INVALID_CREDENTIALS") });
    const user = renderIn(<ChangePasswordScreen />);
    await fill(user, "sai", "mat khau moi 2");
    expect(await screen.findByText("Mật khẩu hiện tại chưa đúng.")).toBeInTheDocument();
    expect(screen.getByLabelText("Mật khẩu hiện tại")).toHaveAttribute("aria-invalid", "true");
    expect(replace).not.toHaveBeenCalled();
  });

  it("names when a locked account opens again (AUTH_LOGIN_LOCKED)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, now: new Date("2026-11-25T03:00:00Z") });
    serve({ "GET /auth/me": me, "POST /auth/password/change": () => problem(429, "AUTH_LOGIN_LOCKED", { "Retry-After": "900" }) });
    const user = renderIn(<ChangePasswordScreen />);
    await fill(user, "sai", "mat khau moi 2");
    const form = within(screen.getByRole("form", { name: "Đổi mật khẩu" }));
    expect(await form.findByRole("alert")).toHaveTextContent("Tạm khoá do nhập sai nhiều lần. Bạn thử lại sau 10:15.");
    expect(screen.getByRole("button", { name: "Lưu mật khẩu" })).toBeDisabled();
    vi.useRealTimers();
  });

  it("puts the policy answer under the new password", async () => {
    serve({ "GET /auth/me": me, "POST /auth/password/change": () => problem(422, "AUTH_PASSWORD_POLICY_VIOLATION") });
    const user = renderIn(<ChangePasswordScreen />);
    await fill(user, "mat khau cu 1", "mat khau cu 1");
    expect(await screen.findByText(/Mật khẩu này chưa đạt yêu cầu/)).toBeInTheDocument();
    expect(screen.getByLabelText("Mật khẩu mới")).toHaveAttribute("aria-invalid", "true");
  });

  it("sends a signed-out Customer to sign-in and back here", async () => {
    serve({ "GET /auth/me": () => problem(401, "AUTH_REQUIRED"), "POST /auth/refresh": () => problem(401, "AUTH_REQUIRED") });
    renderIn(<ChangePasswordScreen />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login?next=%2Faccount%2Fpassword"));
  });
});
