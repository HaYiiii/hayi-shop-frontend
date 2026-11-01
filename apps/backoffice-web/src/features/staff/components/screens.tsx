import { Navigate } from "@tanstack/react-router";
import { PermissionGuard } from "../../../lib/permission-guard";
import { scopeLabel } from "../../../lib/scope";
import { useWorkspace } from "../../../lib/workspace";
import { type NavItem, canOpen, navItems } from "./nav-items";

function OpenScreen({ item, branchId }: { item: NavItem; branchId: string | undefined }) {
  if (item.level === "branch" && branchId) return <Navigate to={item.to} params={{ branchId }} replace />;
  if (item.level === "store") return <Navigate to={item.to} replace />;
  return null;
}

/** Home opens the first screen the scope permits. */
export function HomeScreen() {
  const { permissions, scope } = useWorkspace();
  const first = navItems.find((item) => canOpen(item, scope, permissions));
  if (first) return <OpenScreen item={first} branchId={scope.kind === "branch" ? scope.branchId : undefined} />;
  return (
    <>
      <h1 className="font-display text-heading-lg">Trang chính</h1>
      <p className="text-body text-ink-muted">
        Bạn chưa có quyền dùng màn nào ở phạm vi {scopeLabel(scope)}. Chọn phạm vi khác hoặc nhờ quản lý cấp quyền.
      </p>
    </>
  );
}

/** Screens of later slices: the route exists so the menu and guards can be exercised now. */
export function ScreenPlaceholder({ id }: { id: NavItem["id"] }) {
  const { scope } = useWorkspace();
  const item = navItems.find((i) => i.id === id);
  if (!item) throw new Error(`Unknown screen ${id}`);
  return (
    <>
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="font-display text-heading-lg">{item.label}</h1>
        <span className="text-body text-ink-muted">{scopeLabel(scope)}</span>
      </div>
      <PermissionGuard permission={item.permission}>
        <div className="grid min-h-[480px] flex-1 place-items-center rounded-lg border border-dashed border-line-strong bg-paper p-6 text-center text-body font-medium text-ink-subtle">
          {`Nội dung ${item.label} có ở slice tiếp theo.`}
        </div>
      </PermissionGuard>
    </>
  );
}
