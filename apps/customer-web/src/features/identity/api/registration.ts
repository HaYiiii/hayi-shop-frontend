import type { CustomerComponents } from "@hayi/api-client";
import { type CustomerClient, unwrap } from "../../../lib/customer-api";

export type OtpSent = CustomerComponents["schemas"]["OtpSent"];
export type RegisterBody = CustomerComponents["schemas"]["RegisterRequest"];

/** Step 1: a code for this phone (`POST /auth/otp`, purpose REGISTRATION; Decision AN1–AN2, AN5). */
export function requestRegistrationCode(api: CustomerClient, phone: string) {
  return unwrap(api.POST("/auth/otp", { body: { phone, purpose: "REGISTRATION" } }));
}

/** Step 2: the code proves the phone; the answer is a one-use token (`POST /auth/otp/verify`, AN3). */
export function verifyCode(api: CustomerClient, challengeId: string, code: string) {
  return unwrap(api.POST("/auth/otp/verify", { body: { challengeId, code } }));
}

/** Step 3: the account, without a session (`POST /auth/register`, AN4). */
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
