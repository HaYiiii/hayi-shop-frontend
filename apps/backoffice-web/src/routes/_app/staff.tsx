import { createFileRoute } from "@tanstack/react-router";
import { ScreenPlaceholder } from "../../features/staff/components/screens";

export const Route = createFileRoute("/_app/staff")({ component: () => <ScreenPlaceholder id="staff" /> });
