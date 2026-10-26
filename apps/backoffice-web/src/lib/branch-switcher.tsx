import { Menu } from "@hayi/ui";
import { type Me, type Scope, scopeKey, scopeLabel, scopeOptions } from "./scope";

/** Fixed role system (Decision D3); the spec types role codes as plain strings. */
const roleLabels: Readonly<Record<string, string>> = {
  OWNER: "Chủ cửa hàng",
  ADMIN: "Quản trị",
  MANAGER: "Quản lý chi nhánh",
  STAFF: "Nhân viên",
  BARISTA: "Pha chế",
};

function rolesText(roles: string[]): string {
  return roles.map((r) => roleLabels[r] ?? r).join(", ");
}

function scopeDescription(me: Me, scope: Scope): string {
  if (scope.kind === "store") return rolesText(me.storeRoles);
  return rolesText(me.branches.find((b) => b.branchId === scope.branchId)?.roles ?? me.storeRoles);
}

const HomeIcon = (
  <svg aria-hidden="true" viewBox="0 0 20 20" className="size-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
    <path d="M3 8.5 10 3l7 5.5V17H3V8.5Z" />
    <path d="M8 17v-5h4v5" />
  </svg>
);

interface BranchSwitcherProps {
  me: Me;
  scope: Scope;
  onScopeChange: (scope: Scope) => void;
}

/** Header control for the working scope (Staff Operations §16.2); always shows the current scope. */
export function BranchSwitcher({ me, scope, onScopeChange }: BranchSwitcherProps) {
  const options = scopeOptions(me);
  if (options.length <= 1) {
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
