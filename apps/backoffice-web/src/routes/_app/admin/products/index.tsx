import { createFileRoute } from "@tanstack/react-router";
import type { ProductFilters } from "../../../../features/catalog/api/products";
import { ProductList } from "../../../../features/catalog/components/product-list";
import { productStatusOrder } from "../../../../features/catalog/product-status";
import { PermissionGuard } from "../../../../lib/permission-guard";

/** `page` is 0-based like the API and left out for the first page. */
type ListSearch = ProductFilters;

/** Products (D3d screen 21): brand-level, so the URL carries no Branch (SOURCE-STRUCTURE §3.1). */
export const Route = createFileRoute("/_app/admin/products/")({
  validateSearch: (search: Record<string, unknown>): ListSearch => {
    const status = productStatusOrder.find((s) => s === search.status);
    const categoryId = typeof search.categoryId === "string" && search.categoryId ? search.categoryId : undefined;
    const q = typeof search.q === "string" && search.q.trim() ? search.q.trim().slice(0, 100) : undefined;
    const page = Number(search.page);
    return {
      ...(status && { status }),
      ...(categoryId && { categoryId }),
      ...(q && { q }),
      ...(Number.isInteger(page) && page > 0 && { page }),
    };
  },
  component: ProductListRoute,
});

function ProductListRoute() {
  const filters = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <PermissionGuard permission="CATALOG_VIEW">
      <ProductList
        filters={filters}
        onFiltersChange={(next) =>
          void navigate({
            search: Object.fromEntries(Object.entries(next).filter(([, v]) => v !== undefined)) as ListSearch,
            replace: true,
          })
        }
      />
    </PermissionGuard>
  );
}
