import type { Metadata } from "next";
import { SignUpScreen } from "../../../features/identity/components/sign-up-screen";

export const metadata: Metadata = { title: "Tạo tài khoản · HaYi Shop", robots: { index: false } };

/** Sign-up with a phone code (D3a screen 8, D3f 8b/8c; FE #71). */
export default function RegisterPage() {
  return <SignUpScreen />;
}
