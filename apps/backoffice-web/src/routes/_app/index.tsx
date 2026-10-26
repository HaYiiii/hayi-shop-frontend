import { createFileRoute } from "@tanstack/react-router";
import { HomeScreen } from "../../features/staff/components/screens";

export const Route = createFileRoute("/_app/")({ component: HomeScreen });
