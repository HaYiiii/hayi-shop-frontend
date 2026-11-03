import { createFileRoute } from "@tanstack/react-router";
import { BranchList } from "../../../../features/branch/components/branch-list";
import type { BranchStatus } from "../../../../features/branch/branch-form";
import { statusOrder } from "../../../../features/branch/branch-status";
import { PermissionGuard } from "../../../../lib/permission-guard";

interface ListSearch {
  status?: BranchStatus;
}

/** Branch admin (D3c screen 14): store-level, so the URL carries no scope Branch (SOURCE-STRUCTURE §3.1). */
export const Route = createFileRoute("/_app/admin/branches/")({
  validateSearch: (search: Record<string, unknown>): ListSearch => {
    const status = statusOrder.find((s) => s === search.status);
    return status ? { status } : {};
  },
  component: BranchListScreen,
});

function BranchListScreen() {
  const { status } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <PermissionGuard permission="BRANCH_MANAGE">
      <BranchList status={status} onStatusChange={(next) => void navigate({ search: next ? { status: next } : {} })} />
    </PermissionGuard>
  );
}
