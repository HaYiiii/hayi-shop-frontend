import { Outlet, createFileRoute } from "@tanstack/react-router";
import { BranchPage } from "../../../../features/branch/components/branch-detail";
import { PermissionGuard } from "../../../../lib/permission-guard";

/** `$id`, not `$branchId`: managing a Branch does not change the working scope (SOURCE-STRUCTURE §3.1). */
export const Route = createFileRoute("/_app/admin/branches/$id")({
  component: BranchLayout,
});

function BranchLayout() {
  const { id } = Route.useParams();
  return (
    <PermissionGuard permission="BRANCH_MANAGE">
      <BranchPage key={id} branchId={id}>
        <Outlet />
      </BranchPage>
    </PermissionGuard>
  );
}
