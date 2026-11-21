import { createFileRoute } from "@tanstack/react-router";
import { ProductImagesTab } from "../../../../../features/catalog/components/product-images-tab";

/** Tab "Ảnh" (D3d screen 25). */
export const Route = createFileRoute("/_app/admin/products/$id/images")({
  component: ProductImagesTab,
});
