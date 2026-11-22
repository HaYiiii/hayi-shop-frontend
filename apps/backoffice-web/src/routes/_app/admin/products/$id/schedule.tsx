import { createFileRoute } from "@tanstack/react-router";
import { ProductScheduleTab } from "../../../../../features/catalog/components/product-schedule-tab";
import { ProductTags } from "../../../../../features/catalog/components/product-tags";

/** Tab "Lịch bán & tag" (D3d screen 26): selling schedule (FE #54), then tags (FE #53). */
export const Route = createFileRoute("/_app/admin/products/$id/schedule")({
  component: ScheduleAndTags,
});

function ScheduleAndTags() {
  return (
    <>
      <ProductScheduleTab />
      <ProductTags />
    </>
  );
}
