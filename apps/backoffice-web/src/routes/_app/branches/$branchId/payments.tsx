import { createFileRoute } from "@tanstack/react-router";
import { ScreenPlaceholder } from "../../../../features/staff/components/screens";

export const Route = createFileRoute("/_app/branches/$branchId/payments")({ component: () => <ScreenPlaceholder id="payments" /> });
