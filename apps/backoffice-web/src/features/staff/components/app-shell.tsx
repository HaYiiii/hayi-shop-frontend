import { Menu } from "@hayi/ui";
import type { ReactNode } from "react";

/** Logo and product name; the caller wraps it in its home link. */
export function Brand() {
  return (
    <span className="flex items-center gap-2 text-ink">
      <img src="/logo.webp" width={48} height={48} alt="" />
      <span className="text-body-lg font-semibold">Backoffice</span>
    </span>
  );
}

function initials(name: string): string {
  const parts = name.split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

export function AccountMenu({ name, onLogout }: { name: string; onLogout: () => void }) {
  return (
    <Menu.Root>
      <Menu.Trigger className="rounded-pill border-0 bg-transparent pr-2 pl-1">
        <span aria-hidden="true" className="grid size-8 place-items-center rounded-pill bg-houjicha-100 text-label font-semibold text-houjicha-700">
          {initials(name)}
        </span>
        <span className="max-w-[24ch] truncate" translate="no">
          {name}
        </span>
      </Menu.Trigger>
      <Menu.Content align="end" className="w-60">
        <Menu.Item onSelect={onLogout}>Đăng xuất</Menu.Item>
      </Menu.Content>
    </Menu.Root>
  );
}

interface AppShellProps {
  /** Home link around <Brand />. */
  brand: ReactNode;
  /** Working scope control (branch switcher). */
  scope: ReactNode;
  account: ReactNode;
  nav: ReactNode;
  children: ReactNode;
}

/** Backoffice frame (D3b screen 6): header with brand, scope and account; side menu; main content. */
export function AppShell({ brand, scope, account, nav, children }: AppShellProps) {
  return (
    <div className="grid min-h-dvh grid-rows-[64px_1fr] bg-cream">
      <a
        href="#main"
        className="sr-only rounded-md bg-paper px-3 py-2 text-body font-medium text-matcha-700 focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus-visible:outline-2 focus-visible:outline-focus"
      >
        Bỏ qua đến nội dung chính
      </a>
      <header className="flex items-center gap-4 border-b border-line bg-paper px-4 md:px-6">
        {brand}
        <div className="md:ml-6">{scope}</div>
        <div className="ml-auto">{account}</div>
      </header>
      <div className="grid min-h-0 grid-cols-1 md:grid-cols-[240px_1fr]">
        <div className="border-b border-line bg-paper md:border-r md:border-b-0">{nav}</div>
        <main id="main" tabIndex={-1} className="flex min-w-0 flex-col gap-4 px-4 py-6 outline-none md:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
