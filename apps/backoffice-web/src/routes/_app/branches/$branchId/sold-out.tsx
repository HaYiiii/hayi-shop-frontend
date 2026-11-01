import { createFileRoute } from "@tanstack/react-router";
import { ScreenPlaceholder } from "../../../../features/staff/components/screens";

export const Route = createFileRoute("/_app/branches/$branchId/sold-out")({ component: () => <ScreenPlaceholder id="sold-out" /> });
