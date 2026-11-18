import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ProductDetail } from "../../../../features/catalog/components/product-detail";
import { PermissionGuard } from "../../../../lib/permission-guard";

interface DetailSearch {
  /** `1`: the Product was just created here; shows a confirmation once. */
  created?: 1;
}

export const Route = createFileRoute("/_app/admin/products/$id")({
  validateSearch: (search: Record<string, unknown>): DetailSearch =>
    search.created === 1 || search.created === "1" ? { created: 1 } : {},
  component: ProductDetailRoute,
});

function ProductDetailRoute() {
  const { id } = Route.useParams();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  // The confirmation stays on screen, but the flag leaves the URL so a reload does not show it again.
  const [created] = useState(search.created === 1);
  useEffect(() => {
    if (search.created) void navigate({ search: {}, replace: true });
  }, [search.created, navigate]);

  return (
    <PermissionGuard permission="CATALOG_VIEW">
      <ProductDetail key={id} productId={id} created={created} />
    </PermissionGuard>
  );
}
