import { createFileRoute } from "@tanstack/react-router";
import { ProductScheduleTab } from "../../../../../features/catalog/components/product-schedule-tab";

/** Tab "Lịch bán & tag" (D3d screen 26); the tag section comes with FE #53. */
export const Route = createFileRoute("/_app/admin/products/$id/schedule")({
  component: ProductScheduleTab,
});
