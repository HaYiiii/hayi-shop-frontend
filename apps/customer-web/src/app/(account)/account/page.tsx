import type { Metadata } from "next";
import { AccountScreen } from "../../../features/identity/components/account-screen";
import { TabBar } from "../../../features/shell/tab-bar";

export const metadata: Metadata = { title: "Tài khoản · HaYi Shop", robots: { index: false } };

/** Tab "Tài khoản" (D3f screen 11). `?password=changed` after screen 12 shows its notice (FE #73). */
export default async function AccountPage({ searchParams }: { searchParams: Promise<{ password?: string | string[] }> }) {
  const { password } = await searchParams;
  return (
    <>
      <main className="mx-auto grid w-full max-w-content gap-4 px-4 pt-6 pb-24">
        <AccountScreen passwordChanged={password === "changed"} />
      </main>
      <TabBar current="account" menuHref="/" />
    </>
  );
}
