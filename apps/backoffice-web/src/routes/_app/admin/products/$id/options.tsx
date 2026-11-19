import { createFileRoute } from "@tanstack/react-router";
import { ProductOptionsTab } from "../../../../../features/catalog/components/product-options-tab";

/** Tab "Tuỳ chọn" (D3d screen 24). */
export const Route = createFileRoute("/_app/admin/products/$id/options")({
  component: ProductOptionsTab,
});
