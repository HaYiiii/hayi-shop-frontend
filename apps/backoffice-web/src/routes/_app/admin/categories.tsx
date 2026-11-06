import { createFileRoute } from "@tanstack/react-router";
import { CategoryScreen } from "../../../features/catalog/components/category-screen";
import { PermissionGuard } from "../../../lib/permission-guard";

/** Category tree (D3d screen 20): brand-level, so the URL carries no Branch (SOURCE-STRUCTURE §3.1). */
export const Route = createFileRoute("/_app/admin/categories")({
  component: () => (
    <PermissionGuard permission="CATALOG_VIEW">
      <CategoryScreen />
    </PermissionGuard>
  ),
});
