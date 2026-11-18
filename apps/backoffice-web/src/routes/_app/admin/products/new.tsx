import { createFileRoute } from "@tanstack/react-router";
import { ProductCreate } from "../../../../features/catalog/components/product-create";
import { PermissionGuard } from "../../../../lib/permission-guard";

/** D3d screen 22: creating a Product sets prices, so it needs both permissions (Decision Z4). */
export const Route = createFileRoute("/_app/admin/products/new")({
  component: () => (
    <PermissionGuard permission="CATALOG_MANAGE">
      <PermissionGuard permission="CATALOG_PRICE_MANAGE">
        <ProductCreate />
      </PermissionGuard>
    </PermissionGuard>
  ),
});
