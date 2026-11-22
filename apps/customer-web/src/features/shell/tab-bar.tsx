import { cn, focusRing } from "@hayi/ui";
import Link from "next/link";

type Tab = "menu" | "account";

/**
 * Bottom tab bar (D3a screen 2). Only the tabs whose screens exist (agreed 2026-11-22 on #70): Menu and Tài khoản;
 * Đơn của tôi and Thông báo come with screens 9 and 10. A Server Component: plain links.
 */
export function TabBar({ current, menuHref }: { current: Tab; menuHref: string }) {
  const tabs: { id: Tab; label: string; href: string; icon: string }[] = [
    { id: "menu", label: "Menu", href: menuHref, icon: "M4 6h12M4 10h12M4 14h8" },
    { id: "account", label: "Tài khoản", href: "/account", icon: "M10 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM4.5 16.5a5.5 5.5 0 0 1 11 0" },
  ];
  return (
    <nav aria-label="Điều hướng" className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-paper pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto flex max-w-content">
        {tabs.map((tab) => (
          <li key={tab.id} className="flex-1">
            <Link
              href={tab.href}
              aria-current={tab.id === current ? "page" : undefined}
              className={cn(
                "grid min-h-14 place-items-center gap-0.5 py-1.5 text-caption font-medium text-ink-muted no-underline aria-[current=page]:text-ink",
                focusRing,
              )}
            >
              <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d={tab.icon} />
              </svg>
              {tab.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
