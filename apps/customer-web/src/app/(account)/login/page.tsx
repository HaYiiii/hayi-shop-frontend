import type { Metadata } from "next";
import { LoginScreen } from "../../../features/identity/components/login-screen";

export const metadata: Metadata = { title: "Đăng nhập · HaYi Shop", robots: { index: false } };

/** D3a screen 8, sign-in. `?next=` is where to go back to (a path on this site only). */
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const { next } = await searchParams;
  return <LoginScreen next={typeof next === "string" ? next : undefined} />;
}
