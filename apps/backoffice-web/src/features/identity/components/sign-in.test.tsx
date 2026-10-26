import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createTestWrapper, fakeApi, json, noContent, problem } from "../../../test/fake-api";
import { SignIn } from "./sign-in";

const done = {
  passwordChangeRequired: false,
  changeToken: null,
  mfaRequired: false,
  mfaChallengeId: null,
  mfaEnrollmentRequired: false,
  enrollmentToken: null,
};

function setup() {
  const onSignedIn = vi.fn();
  const user = userEvent.setup();
  render(<SignIn onSignedIn={onSignedIn} />, { wrapper: createTestWrapper() });
  return { user, onSignedIn };
}

async function logIn(user: ReturnType<typeof userEvent.setup>, password = "mat khau dung 01") {
  await user.type(screen.getByLabelText("Email, mã nhân viên hoặc số điện thoại"), "owner@hayi.vn");
  await user.type(screen.getByLabelText("Mật khẩu"), password);
  await user.click(screen.getByRole("button", { name: "Đăng nhập" }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SignIn — login (API 01-security §6.2, Decision K2)", () => {
  it("signs in directly when no further step is needed", async () => {
    const api = fakeApi({ "POST /auth/login": () => json(done) });
    const { user, onSignedIn } = setup();

    await logIn(user);

    await waitFor(() => expect(onSignedIn).toHaveBeenCalledOnce());
    expect(api.bodyOf("POST /auth/login")).toEqual({ identifier: "owner@hayi.vn", password: "mat khau dung 01" });
  });

  it("never treats a step flag without its token as signed in", async () => {
    fakeApi({ "POST /auth/login": () => json({ ...done, mfaRequired: true }) });
    const { user, onSignedIn } = setup();

    await logIn(user);

    expect(await screen.findByRole("alert")).toHaveTextContent("Có lỗi khi đăng nhập");
    expect(onSignedIn).not.toHaveBeenCalled();
  });

  it("shows a password toggle", async () => {
    const { user } = setup();
    const password = screen.getByLabelText("Mật khẩu");

    await user.click(screen.getByRole("button", { name: "Hiện mật khẩu" }));

    expect(password).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Ẩn mật khẩu" })).toBeInTheDocument();
  });

  it("explains wrong credentials without saying which one was wrong", async () => {
    fakeApi({ "POST /auth/login": () => problem(401, "AUTH_INVALID_CREDENTIALS") });
    const { user, onSignedIn } = setup();

    await logIn(user, "sai");

    expect(await screen.findByRole("alert")).toHaveTextContent("Tài khoản hoặc mật khẩu chưa đúng");
    expect(screen.getByLabelText("Mật khẩu")).toHaveAttribute("aria-invalid", "true");
    expect(onSignedIn).not.toHaveBeenCalled();
  });

  it("shows until when the account is locked and blocks submitting", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-27T07:37:00Z") });
    fakeApi({ "POST /auth/login": () => problem(429, "AUTH_LOGIN_LOCKED", { "Retry-After": "900" }) });
    const { user } = setup();

    await logIn(user);

    // 07:52Z is 14:52 in Asia/Ho_Chi_Minh.
    expect(await screen.findByRole("alert")).toHaveTextContent("Bạn thử lại sau 14:52");
    expect(screen.getByRole("button", { name: "Đăng nhập" })).toBeDisabled();
    vi.useRealTimers();
  });
});

describe("SignIn — MFA verify", () => {
  it("asks for the TOTP code and finishes with it", async () => {
    const api = fakeApi({
      "POST /auth/login": () => json({ ...done, mfaRequired: true, mfaChallengeId: "ch-1" }),
      "POST /auth/mfa/verify": () => noContent(),
    });
    const { user, onSignedIn } = setup();

    await logIn(user);
    expect(await screen.findByRole("heading", { name: "Xác thực 2 lớp" })).toBeInTheDocument();
    expect(screen.getByText("owner@hayi.vn")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Mã xác thực"), "482913");
    await user.click(screen.getByRole("button", { name: "Xác nhận" }));

    await waitFor(() => expect(onSignedIn).toHaveBeenCalledOnce());
    expect(api.bodyOf("POST /auth/mfa/verify")).toEqual({ mfaChallengeId: "ch-1", code: "482913" });
  });

  it("accepts a recovery code instead", async () => {
    const api = fakeApi({
      "POST /auth/login": () => json({ ...done, mfaRequired: true, mfaChallengeId: "ch-1" }),
      "POST /auth/mfa/verify": () => noContent(),
    });
    const { user, onSignedIn } = setup();

    await logIn(user);
    await user.click(await screen.findByRole("button", { name: "Dùng mã khôi phục" }));
    await user.type(screen.getByLabelText("Mã khôi phục"), "A7KD-29FQ");
    await user.click(screen.getByRole("button", { name: "Xác nhận" }));

    await waitFor(() => expect(onSignedIn).toHaveBeenCalledOnce());
    expect(api.bodyOf("POST /auth/mfa/verify")).toEqual({ mfaChallengeId: "ch-1", code: "A7KD-29FQ" });
  });

  it("keeps the user on the step after a wrong code", async () => {
    fakeApi({
      "POST /auth/login": () => json({ ...done, mfaRequired: true, mfaChallengeId: "ch-1" }),
      "POST /auth/mfa/verify": () => problem(401, "MFA_CODE_INVALID"),
    });
    const { user } = setup();

    await logIn(user);
    await user.type(await screen.findByLabelText("Mã xác thực"), "000000");
    await user.click(screen.getByRole("button", { name: "Xác nhận" }));

    expect(await screen.findByText(/Mã chưa đúng/)).toBeInTheDocument();
    expect(screen.getByLabelText("Mã xác thực")).toHaveAttribute("aria-invalid", "true");
  });

  it("returns to the login form when the challenge is locked", async () => {
    fakeApi({
      "POST /auth/login": () => json({ ...done, mfaRequired: true, mfaChallengeId: "ch-1" }),
      "POST /auth/mfa/verify": () => problem(401, "MFA_CHALLENGE_LOCKED"),
    });
    const { user } = setup();

    await logIn(user);
    await user.type(await screen.findByLabelText("Mã xác thực"), "000000");
    await user.click(screen.getByRole("button", { name: "Xác nhận" }));

    expect(await screen.findByRole("heading", { name: "Đăng nhập Backoffice" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Nhập sai mã quá nhiều lần");
  });
});

describe("SignIn — first password change (Decision K3, K4)", () => {
  it("sets a new password, then asks to sign in again with it", async () => {
    const api = fakeApi({
      "POST /auth/login": () => json({ ...done, passwordChangeRequired: true, changeToken: "ct-1" }),
      "POST /auth/password/first-change": () => noContent(),
    });
    const { user, onSignedIn } = setup();

    await logIn(user);
    expect(await screen.findByRole("heading", { name: "Đặt mật khẩu mới" })).toBeInTheDocument();
    await user.type(screen.getByLabelText("Mật khẩu mới"), "matcha sua tuoi 2026");
    await user.type(screen.getByLabelText("Nhập lại mật khẩu mới"), "matcha sua tuoi 2026");
    await user.click(screen.getByRole("button", { name: "Lưu mật khẩu và tiếp tục" }));

    expect(await screen.findByRole("heading", { name: "Đăng nhập Backoffice" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Đã đổi mật khẩu");
    expect(screen.getByLabelText("Email, mã nhân viên hoặc số điện thoại")).toHaveValue("owner@hayi.vn");
    expect(screen.getByLabelText("Mật khẩu")).toHaveValue("");
    expect(api.bodyOf("POST /auth/password/first-change")).toEqual({
      changeToken: "ct-1",
      newPassword: "matcha sua tuoi 2026",
    });
    expect(onSignedIn).not.toHaveBeenCalled();
  });

  it("checks length and confirmation before calling the API", async () => {
    const api = fakeApi({
      "POST /auth/login": () => json({ ...done, passwordChangeRequired: true, changeToken: "ct-1" }),
    });
    const { user } = setup();

    await logIn(user);
    await user.type(await screen.findByLabelText("Mật khẩu mới"), "ngan qua");
    await user.type(screen.getByLabelText("Nhập lại mật khẩu mới"), "khac");
    await user.click(screen.getByRole("button", { name: "Lưu mật khẩu và tiếp tục" }));

    expect(screen.getByText(/Hai mật khẩu chưa khớp/)).toBeInTheDocument();
    expect(screen.getByLabelText("Mật khẩu mới")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Mật khẩu mới")).toHaveFocus();
    expect(api.calls.map((c) => c.route)).not.toContain("POST /auth/password/first-change");
  });

  it("shows the server's policy rejection", async () => {
    fakeApi({
      "POST /auth/login": () => json({ ...done, passwordChangeRequired: true, changeToken: "ct-1" }),
      "POST /auth/password/first-change": () => problem(422, "AUTH_PASSWORD_POLICY_VIOLATION"),
    });
    const { user } = setup();

    await logIn(user);
    await user.type(await screen.findByLabelText("Mật khẩu mới"), "password1234");
    await user.type(screen.getByLabelText("Nhập lại mật khẩu mới"), "password1234");
    await user.click(screen.getByRole("button", { name: "Lưu mật khẩu và tiếp tục" }));

    expect(await screen.findByText(/quá phổ biến hoặc trùng mật khẩu hiện tại/)).toBeInTheDocument();
  });
});

describe("SignIn — MFA enrollment (Decision L2)", () => {
  it("shows the setup key, confirms the code, then shows recovery codes once", async () => {
    const api = fakeApi({
      "POST /auth/login": () => json({ ...done, mfaEnrollmentRequired: true, enrollmentToken: "et-1" }),
      "POST /auth/mfa/enroll": () =>
        json({ otpauthUri: "otpauth://totp/HaYi:owner?secret=JBSWY3DPEHPK3PXP", secret: "JBSWY3DPEHPK3PXP" }),
      "POST /auth/mfa/enroll/confirm": () => json({ recoveryCodes: ["A7KD-29FQ", "M3XP-71RT"] }),
    });
    const { user, onSignedIn } = setup();

    await logIn(user);
    expect(await screen.findByText("JBSW Y3DP EHPK 3PXP")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Mã QR thiết lập xác thực 2 lớp" })).toBeInTheDocument();
    await user.type(screen.getByLabelText("Mã từ ứng dụng"), "482913");
    await user.click(screen.getByRole("button", { name: "Xác nhận và bật" }));

    expect(await screen.findByRole("heading", { name: "Lưu mã khôi phục" })).toBeInTheDocument();
    expect(screen.getByText("A7KD-29FQ")).toBeInTheDocument();
    expect(api.bodyOf("POST /auth/mfa/enroll")).toEqual({ enrollmentToken: "et-1" });
    expect(api.bodyOf("POST /auth/mfa/enroll/confirm")).toEqual({ enrollmentToken: "et-1", code: "482913" });

    const enter = screen.getByRole("button", { name: "Vào Backoffice" });
    expect(enter).toBeDisabled();
    await user.click(screen.getByLabelText("Tôi đã lưu các mã ở nơi an toàn"));
    await user.click(enter);
    expect(onSignedIn).toHaveBeenCalledOnce();
  });

  it("keeps the user on the step after a wrong code", async () => {
    fakeApi({
      "POST /auth/login": () => json({ ...done, mfaEnrollmentRequired: true, enrollmentToken: "et-1" }),
      "POST /auth/mfa/enroll": () => json({ otpauthUri: "otpauth://totp/x?secret=AAAA", secret: "AAAA" }),
      "POST /auth/mfa/enroll/confirm": () => problem(401, "MFA_CODE_INVALID"),
    });
    const { user } = setup();

    await logIn(user);
    await user.type(await screen.findByLabelText("Mã từ ứng dụng"), "000000");
    await user.click(screen.getByRole("button", { name: "Xác nhận và bật" }));

    expect(await screen.findByText(/Mã chưa đúng/)).toBeInTheDocument();
  });
});
