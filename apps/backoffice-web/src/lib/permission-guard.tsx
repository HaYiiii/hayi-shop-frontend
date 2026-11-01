import type { ReactNode } from "react";
import { useWorkspace } from "./workspace";

/**
 * Renders a screen only when the current scope grants `permission` (01-security.md §7). UX only:
 * the API answers 403 whatever the UI shows (Decision M4).
 */
export function PermissionGuard({ permission, children }: { permission: string; children: ReactNode }) {
  const { permissions } = useWorkspace();
  if (permissions.has(permission)) return children;
  return (
    <div role="status" className="grid min-h-[480px] flex-1 place-items-center rounded-lg border border-dashed border-line-strong bg-paper p-6 text-center text-body font-medium text-ink-subtle">
      Bạn không có quyền xem màn này ở phạm vi đang chọn.
    </div>
  );
}
