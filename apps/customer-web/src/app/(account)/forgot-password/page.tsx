import type { Metadata } from "next";
import { ForgotPasswordScreen } from "../../../features/identity/components/forgot-password-screen";

export const metadata: Metadata = { title: "Quên mật khẩu · HaYi Shop", robots: { index: false } };

/** D3f 8d: forgot password (FE #73). */
export default function ForgotPasswordPage() {
  return <ForgotPasswordScreen />;
}
