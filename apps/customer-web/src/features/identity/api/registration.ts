import type { CustomerComponents } from "@hayi/api-client";
import { type CustomerClient, unwrap } from "../../../lib/customer-api";

export type OtpSent = CustomerComponents["schemas"]["OtpSent"];
export type RegisterBody = CustomerComponents["schemas"]["RegisterRequest"];
export type OtpPurpose = CustomerComponents["schemas"]["OtpPurpose"];

/**
 * Step 1: a code for this phone (`POST /auth/otp`; Decision AN1–AN2, AN5). Always `202`: for PASSWORD_RECOVERY a
 * phone without an account gets no SMS and the same answer (AS1).
 */
export function requestCode(api: CustomerClient, phone: string, purpose: OtpPurpose) {
  return unwrap(api.POST("/auth/otp", { body: { phone, purpose } }));
}

/** Step 2: the code proves the phone; the answer is a one-use token (`POST /auth/otp/verify`, AN3). */
export function verifyCode(api: CustomerClient, challengeId: string, code: string) {
  return unwrap(api.POST("/auth/otp/verify", { body: { challengeId, code } }));
}

/** Sign-up step 3: the account, without a session (`POST /auth/register`, AN4). */
export function register(api: CustomerClient, body: RegisterBody) {
  return unwrap(api.POST("/auth/register", { body }));
}

/** Wrong codes a challenge takes before it locks (API 01-security §6.1, §6.3: `maxAttempts = 5`). */
export const OTP_MAX_ATTEMPTS = 5;

/** "0901 ••• 567" from what was typed (digits only). */
export function maskPhone(phone: string): string {
  return phone.length >= 7 ? `${phone.slice(0, 4)} ••• ${phone.slice(-3)}` : phone;
}

/** Whole minutes until a `Retry-After` ends, at least 1. */
export function minutesFrom(seconds: unknown): number | null {
  return typeof seconds === "number" && seconds > 0 ? Math.max(1, Math.ceil(seconds / 60)) : null;
}

/** Recovery step 3: a new password with the PASSWORD_RECOVERY proof; every session ends (`POST /auth/password/reset`, AS2). */
export function resetPassword(api: CustomerClient, verificationToken: string, newPassword: string) {
  return unwrap(api.POST("/auth/password/reset", { body: { verificationToken, newPassword } }));
}

/** Screen 12: the signed-in Customer's password; other sessions end, this one stays (`POST /auth/password/change`, AS3). */
export function changePassword(api: CustomerClient, currentPassword: string, newPassword: string) {
  return unwrap(api.POST("/auth/password/change", { body: { currentPassword, newPassword } }));
}

/** Local limits before the server's policy (8–128; a Staff persona needs 12, AS4 — the server says so). */
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

/** Copy for `422 AUTH_PASSWORD_POLICY_VIOLATION` (also the same password again, AS3–AS4). */
export const PASSWORD_POLICY_TEXT = "Mật khẩu này chưa đạt yêu cầu: dễ đoán, trùng mật khẩu cũ, hoặc chưa đủ dài (tài khoản nhân viên cần 12 ký tự). Chọn mật khẩu khác.";

/** Local check of a new password; `null` when it may be sent. */
export function newPasswordProblem(password: string): string | null {
  if (!password) return "Nhập mật khẩu mới.";
  if (password.length < PASSWORD_MIN) return `Mật khẩu cần ít nhất ${PASSWORD_MIN} ký tự.`;
  if (password.length > PASSWORD_MAX) return `Mật khẩu tối đa ${PASSWORD_MAX} ký tự.`;
  return null;
}
