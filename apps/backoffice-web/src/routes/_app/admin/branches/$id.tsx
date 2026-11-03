import { createFileRoute } from "@tanstack/react-router";
import { BranchDetail } from "../../../../features/branch/components/branch-detail";
import { PermissionGuard } from "../../../../lib/permission-guard";

/** `$id`, not `$branchId`: managing a Branch does not change the working scope (SOURCE-STRUCTURE §3.1). */
export const Route = createFileRoute("/_app/admin/branches/$id")({
  component: BranchDetailScreen,
});

function BranchDetailScreen() {
  const { id } = Route.useParams();
  return (
    <PermissionGuard permission="BRANCH_MANAGE">
      <BranchDetail key={id} branchId={id} />
    </PermissionGuard>
  );
}
