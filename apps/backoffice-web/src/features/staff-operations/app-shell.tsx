import { Menu } from "@hayi/ui";
import type { ReactNode } from "react";
import type { NavItem } from "./nav-items";
import { NavMenu } from "./nav-menu";
import { type Me, type Scope, permissionsIn, scopeKey, scopeOptions } from "./workspace-scope";

/** Fixed role system (Decision D3). */
const roleLabels: Record<string, string> = {
  OWNER: "Chủ cửa hàng",
  ADMIN: "Quản trị",
  MANAGER: "Quản lý chi nhánh",
  STAFF: "Nhân viên",
  BARISTA: "Pha chế",
};

function rolesText(roles: string[]): string {
  return roles.map((r) => roleLabels[r] ?? r).join(", ");
}

/** Branch names need the Branch module; until then the switcher shows the id (follow-up ticket). */
function scopeLabel(scope: Scope): string {
  return scope.kind === "store" ? "Toàn hệ thống" : `Chi nhánh ${scope.branchId}`;
}

function scopeDescription(me: Me, scope: Scope): string {
  if (scope.kind === "store") return rolesText(me.storeRoles);
  return rolesText(me.branches.find((b) => b.branchId === scope.branchId)?.roles ?? []);
}

const HomeIcon = (
  <svg aria-hidden="true" viewBox="0 0 20 20" className="size-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
    <path d="M3 8.5 10 3l7 5.5V17H3V8.5Z" />
    <path d="M8 17v-5h4v5" />
  </svg>
);

function ScopeSwitcher({ me, scope, onScopeChange }: Pick<AppShellProps, "me" | "scope" | "onScopeChange">) {
  const options = scopeOptions(me);
  if (options.length <= 1) {
    // Current scope is always visible, even without a choice to make.
    return (
      <p className="flex h-control-default items-center gap-2.5 px-3 text-body font-medium">
        {HomeIcon}
        <span className="text-ink-muted">Phạm vi:</span>
        <span className="max-w-[28ch] truncate">{scopeLabel(scope)}</span>
      </p>
    );
  }
  return (
    <Menu.Root>
      <Menu.Trigger>
        {HomeIcon}
        <span className="max-w-[36ch] min-w-0 truncate">
          <span className="text-ink-muted">Phạm vi:</span> {scopeLabel(scope)}
        </span>
      </Menu.Trigger>
      <Menu.Content>
        <Menu.Label>{me.storeRoles.length > 0 ? "Phạm vi làm việc" : "Chi nhánh bạn được giao"}</Menu.Label>
        <Menu.RadioGroup
          value={scopeKey(scope)}
          onValueChange={(key) => {
            const next = options.find((s) => scopeKey(s) === key);
            if (next) onScopeChange(next);
          }}
        >
          {options.map((option) => (
            <Menu.RadioItem key={scopeKey(option)} value={scopeKey(option)} description={scopeDescription(me, option)}>
              {scopeLabel(option)}
            </Menu.RadioItem>
          ))}
        </Menu.RadioGroup>
        <p className="mt-1 border-t border-line px-3 pt-2 pb-1 text-caption text-ink-muted">
          Đổi chi nhánh sẽ đổi quyền theo vai trò ở chi nhánh đó.
        </p>
      </Menu.Content>
    </Menu.Root>
  );
}

function initials(name: string): string {
  const parts = name.split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

function AccountMenu({ name, onLogout }: { name: string; onLogout: () => void }) {
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
  me: Me;
  scope: Scope;
  onScopeChange: (scope: Scope) => void;
  /** Shown on the account button. */
  accountName: string;
  onLogout: () => void;
  renderLink: (item: NavItem) => ReactNode;
  /** Link to the home screen (logo). */
  homeLink?: (content: ReactNode) => ReactNode;
  children: ReactNode;
}

/** Backoffice frame (D3b screen 6): header with scope switcher and account, permission-driven menu. */
export function AppShell({ me, scope, onScopeChange, accountName, onLogout, renderLink, homeLink, children }: AppShellProps) {
  const brand = (
    <span className="flex items-center gap-2 text-ink">
      <img src="/logo.webp" width={48} height={48} alt="" />
      <span className="text-[15px] leading-5 font-semibold">Backoffice</span>
    </span>
  );
  return (
    <div className="grid min-h-dvh grid-rows-[64px_1fr] bg-cream">
      <a
        href="#main"
        className="sr-only rounded-md bg-paper px-3 py-2 text-body font-medium text-matcha-700 focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus-visible:outline-2 focus-visible:outline-focus"
      >
        Bỏ qua đến nội dung chính
      </a>
      <header className="flex items-center gap-4 border-b border-line bg-paper px-4 md:px-6">
        {homeLink ? homeLink(brand) : brand}
        <div className="md:ml-6">
          <ScopeSwitcher me={me} scope={scope} onScopeChange={onScopeChange} />
        </div>
        <div className="ml-auto">
          <AccountMenu name={accountName} onLogout={onLogout} />
        </div>
      </header>
      <div className="grid min-h-0 grid-cols-1 md:grid-cols-[240px_1fr]">
        <div className="border-b border-line bg-paper md:border-r md:border-b-0">
          <NavMenu permissions={permissionsIn(me, scope)} renderLink={renderLink} />
        </div>
        <main id="main" tabIndex={-1} className="flex min-w-0 flex-col gap-4 px-4 py-6 outline-none md:px-8">{children}</main>
      </div>
    </div>
  );
}
