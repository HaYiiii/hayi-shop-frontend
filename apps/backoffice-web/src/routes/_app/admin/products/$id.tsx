import { createFileRoute } from "@tanstack/react-router";
import { ProductDetail } from "../../../../features/catalog/components/product-detail";
import { PermissionGuard } from "../../../../lib/permission-guard";

interface DetailSearch {
  /** `1`: the Product was just created here; shows a confirmation. */
  created?: 1;
}

export const Route = createFileRoute("/_app/admin/products/$id")({
  validateSearch: (search: Record<string, unknown>): DetailSearch =>
    search.created === 1 || search.created === "1" ? { created: 1 } : {},
  component: ProductDetailRoute,
});

function ProductDetailRoute() {
  const { id } = Route.useParams();
  const { created } = Route.useSearch();
  return (
    <PermissionGuard permission="CATALOG_VIEW">
      <ProductDetail key={id} productId={id} created={created === 1} />
    </PermissionGuard>
  );
}
