import type { Metadata } from "next";
import { ChangePasswordScreen } from "../../../../features/identity/components/change-password-screen";

export const metadata: Metadata = { title: "Đổi mật khẩu · HaYi Shop", robots: { index: false } };

/** D3f screen 12: change password while signed in (FE #73). */
export default function ChangePasswordPage() {
  return <ChangePasswordScreen />;
}
