import type { Metadata } from "next";
import { AccountScreen } from "../../../features/identity/components/account-screen";
import { TabBar } from "../../../features/shell/tab-bar";

export const metadata: Metadata = { title: "Tài khoản · HaYi Shop", robots: { index: false } };

/** Tab "Tài khoản" (FE #70: sign-in gate, name, sign-out); screen 11 in #72. */
export default function AccountPage() {
  return (
    <>
      <main className="mx-auto grid w-full max-w-content gap-4 px-4 pt-6 pb-24">
        <AccountScreen />
      </main>
      <TabBar current="account" menuHref="/" />
    </>
  );
}
