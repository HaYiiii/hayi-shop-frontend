import { createFileRoute } from "@tanstack/react-router";
import { ScreenPlaceholder } from "../../../../features/staff/components/screens";

export const Route = createFileRoute("/_app/branches/$branchId/slots")({ component: () => <ScreenPlaceholder id="slots" /> });
