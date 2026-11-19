import { Outlet, createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { ProductPage } from "../../../../features/catalog/components/product-page";
import { PermissionGuard } from "../../../../lib/permission-guard";

interface DetailSearch {
  /** `1`: the Product was just created here; shows a confirmation once. */
  created?: 1;
}

export const Route = createFileRoute("/_app/admin/products/$id")({
  validateSearch: (search: Record<string, unknown>): DetailSearch =>
    search.created === 1 || search.created === "1" ? { created: 1 } : {},
  component: ProductLayout,
});

function ProductLayout() {
  const { id } = Route.useParams();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  // The page keeps the confirmation on screen; the flag leaves the URL so a reload does not show it again.
  useEffect(() => {
    if (search.created) void navigate({ search: {}, replace: true });
  }, [search.created, navigate]);

  return (
    <PermissionGuard permission="CATALOG_VIEW">
      <ProductPage key={id} productId={id} created={search.created === 1}>
        <Outlet />
      </ProductPage>
    </PermissionGuard>
  );
}
