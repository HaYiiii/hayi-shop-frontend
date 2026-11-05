import { createFileRoute } from "@tanstack/react-router";
import { SlotConfigScreen } from "../../../../features/fulfillment/components/slot-config";

/** D3b screen 13 (Fulfillment §8.3–8.5, API 09 §2). */
export const Route = createFileRoute("/_app/branches/$branchId/slots")({ component: SlotsRoute });

function SlotsRoute() {
  const { branchId } = Route.useParams();
  return <SlotConfigScreen branchId={branchId} />;
}
