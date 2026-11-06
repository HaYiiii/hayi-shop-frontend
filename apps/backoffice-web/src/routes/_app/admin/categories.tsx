import { createFileRoute } from "@tanstack/react-router";
import { CategoryScreen } from "../../../features/catalog/components/category-screen";
import { PermissionGuard } from "../../../lib/permission-guard";

interface CategorySearch {
  /** `1`: archived Categories are shown in the tree too. */
  archived?: 1;
}

/** Category tree (D3d screen 20): brand-level, so the URL carries no Branch (SOURCE-STRUCTURE §3.1). */
export const Route = createFileRoute("/_app/admin/categories")({
  validateSearch: (search: Record<string, unknown>): CategorySearch =>
    search.archived === 1 || search.archived === "1" ? { archived: 1 } : {},
  component: CategoriesRoute,
});

function CategoriesRoute() {
  const { archived } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <PermissionGuard permission="CATALOG_VIEW">
      <CategoryScreen
        showArchived={archived === 1}
        onShowArchivedChange={(show) => void navigate({ search: show ? { archived: 1 } : {}, replace: true })}
      />
    </PermissionGuard>
  );
}
