import { createFileRoute } from "@tanstack/react-router";
import { BranchCreate } from "../../../../features/branch/components/branch-create";
import { PermissionGuard } from "../../../../lib/permission-guard";

export const Route = createFileRoute("/_app/admin/branches/new")({
  component: () => (
    <PermissionGuard permission="BRANCH_MANAGE">
      <BranchCreate />
    </PermissionGuard>
  ),
});
