import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CustomerProviders } from "../../../lib/customer-api";
import { LoginScreen } from "./login-screen";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push: replace, refresh: vi.fn() }) }));

type Answer = (request: Request) => Response | Promise<Response>;

/** Answers by `METHOD path` under /api/customer/v1; records method, path, body and CSRF header. */
function serve(answers: Record<string, Answer>) {
  const calls: { route: string; body: string; csrf: string | null }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (request: Request) => {
      const route = `${request.method} ${new URL(request.url).pathname.replace("/api/customer/v1", "")}`;
      calls.push({ route, body: await request.clone().text(), csrf: request.headers.get("X-CSRF-Token") });
      const answer = answers[route];
      return answer ? answer(request) : Response.json({ status: 404, code: "NOT_FOUND" }, { status: 404 });
    }),
  );
  return calls;
}

const problem = (status: number, code: string, headers: Record<string, string> = {}) =>
  Response.json({ status, code }, { status, headers: { "Content-Type": "application/problem+json", ...headers } });

function renderLogin(next = "/account") {
  const user = userEvent.setup();
  render(
    <CustomerProviders>
      <LoginScreen next={next} />
    </CustomerProviders>,
  );
  return user;
}

async function signIn(user: ReturnType<typeof userEvent.setup>, phone = "0901 234 567", password = "mat khau dung") {
  await user.type(screen.getByLabelText("Số điện thoại"), phone);
  await user.type(screen.getByLabelText("Mật khẩu"), password);
  await user.click(screen.getByRole("button", { name: "Đăng nhập" }));
}

afterEach(() => {
  vi.unstubAllGlobals();
  replace.mockReset();
});

describe("Customer sign-in (D3a screen 8, FE #70)", () => {
  it("signs in with phone and password, sends the CSRF header, and goes back to the page it came from", async () => {
    document.cookie = "hy_c_csrf=c-token";
    const calls = serve({
      "POST /auth/login": () => Response.json({ verificationRequired: false, challengeId: null }),
      "GET /auth/me": () => Response.json({ userId: "u", customerId: "c", displayName: "Lan", phoneMasked: "090•••567" }),
    });
    const user = renderLogin("/b/Q1-LELOI/menu");

    expect(screen.getByRole("heading", { level: 1, name: "Chào bạn trở lại" })).toBeInTheDocument();
    expect(screen.getByLabelText("Số điện thoại")).toHaveAttribute("type", "tel");
    expect(screen.getByRole("link", { name: "Đăng ký bằng số điện thoại" })).toHaveAttribute("href", "/register");
    expect(screen.getByRole("link", { name: "Quên mật khẩu?" })).toHaveAttribute("href", "/forgot-password");
    await signIn(user);

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/b/Q1-LELOI/menu"));
    const login = calls.find((c) => c.route === "POST /auth/login")!;
    expect(JSON.parse(login.body)).toEqual({ phone: "0901234567", password: "mat khau dung" });
    expect(login.csrf).toBe("c-token");
    document.cookie = "hy_c_csrf=; max-age=0";
  });

  it("says the phone or password is wrong (AUTH_INVALID_CREDENTIALS)", async () => {
    serve({ "POST /auth/login": () => problem(401, "AUTH_INVALID_CREDENTIALS") });
    const user = renderLogin();
    await signIn(user);
    expect(await screen.findByRole("alert")).toHaveTextContent("Số điện thoại hoặc mật khẩu chưa đúng.");
    expect(screen.getByLabelText("Mật khẩu")).toHaveAttribute("aria-invalid", "true");
    expect(replace).not.toHaveBeenCalled();
  });

  it("names when a locked sign-in opens again, from Retry-After (AUTH_LOGIN_LOCKED)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, now: new Date("2026-11-22T03:00:00Z") });
    serve({ "POST /auth/login": () => problem(429, "AUTH_LOGIN_LOCKED", { "Retry-After": "900" }) });
    const user = renderLogin();
    await signIn(user);
    // 03:15 UTC is 10:15 in Asia/Ho_Chi_Minh.
    expect(await screen.findByRole("alert")).toHaveTextContent("Đăng nhập tạm khoá do nhập sai nhiều lần. Bạn thử lại sau 10:15.");
    expect(screen.getByRole("button", { name: "Đăng nhập" })).toBeDisabled();
    vi.useRealTimers();
  });

  it("asks to slow down on RATE_LIMITED", async () => {
    serve({ "POST /auth/login": () => problem(429, "RATE_LIMITED") });
    const user = renderLogin();
    await signIn(user);
    expect(await screen.findByRole("alert")).toHaveTextContent("Bạn thao tác quá nhanh. Đợi một chút rồi thử lại.");
  });

  it.each(["//evil.test/x", "/\t/evil.test", "/\n/evil.test", "/\\evil.test"])("never goes to another site after sign-in (next=%j)", async (next) => {
    serve({
      "POST /auth/login": () => Response.json({ verificationRequired: false, challengeId: null }),
      "GET /auth/me": () => Response.json({ userId: "u", customerId: "c", displayName: "Lan", phoneMasked: "090•••567" }),
    });
    const user = renderLogin(next);
    expect(screen.getByRole("link", { name: "Đóng" })).toHaveAttribute("href", "/");
    await signIn(user);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/account"));
  });

  it("asks for an empty phone or password here, without calling the API", async () => {
    const calls = serve({});
    const user = renderLogin();
    await user.click(screen.getByRole("button", { name: "Đăng nhập" }));
    expect(screen.getByText("Nhập số điện thoại.")).toBeInTheDocument();
    expect(screen.getByText("Nhập mật khẩu.")).toBeInTheDocument();
    expect(screen.getByLabelText("Số điện thoại")).toHaveFocus();
    expect(screen.getByLabelText("Số điện thoại")).toHaveAttribute("aria-invalid", "true");
    expect(calls).toHaveLength(0);
  });
});
