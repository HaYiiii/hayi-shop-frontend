import { createFileRoute } from "@tanstack/react-router";
import { ProductInfoTab } from "../../../../../features/catalog/components/product-info-tab";

/** Tab "Thông tin & size" (D3d screen 23). */
export const Route = createFileRoute("/_app/admin/products/$id/")({
  component: ProductInfoTab,
});
