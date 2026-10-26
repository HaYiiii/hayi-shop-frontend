import { Navigate } from "@tanstack/react-router";
import type { NavItem } from "../features/staff-operations/nav-items";
import { navItems } from "../features/staff-operations/nav-items";
import { useWorkspace } from "../features/staff-operations/workspace-context";
import type { Scope } from "../features/staff-operations/workspace-scope";

function scopeText(scope: Scope): string {
  return scope.kind === "store" ? "Toàn hệ thống" : `Chi nhánh ${scope.branchId}`;
}

/** Home opens the first screen the scope permits. */
export function HomeScreen() {
  const { permissions, scope } = useWorkspace();
  const first = navItems.find((item) => permissions.has(item.permission));
  if (first) return <Navigate to={first.path} replace />;
  return (
    <>
      <h1 className="font-display text-heading-lg">Trang chính</h1>
      <p className="text-body text-ink-muted">
        Bạn chưa có quyền dùng màn nào ở phạm vi {scopeText(scope)}. Chọn phạm vi khác hoặc nhờ quản lý cấp quyền.
      </p>
    </>
  );
}

/** Screens of later slices: the route exists so the menu and guards can be exercised now. */
export function ScreenPlaceholder({ item }: { item: NavItem }) {
  const { permissions, scope } = useWorkspace();
  return (
    <>
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="font-display text-heading-lg">{item.label}</h1>
        <span className="text-body text-ink-muted">{scopeText(scope)}</span>
      </div>
      <div className="grid min-h-[480px] flex-1 place-items-center rounded-lg border border-dashed border-line-strong bg-paper p-6 text-center text-body font-medium text-ink-subtle">
        {permissions.has(item.permission)
          ? `Nội dung ${item.label} có ở slice tiếp theo.`
          : "Bạn không có quyền xem màn này ở phạm vi đang chọn."}
      </div>
    </>
  );
}
