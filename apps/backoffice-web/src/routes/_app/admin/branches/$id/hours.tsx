import { createFileRoute } from "@tanstack/react-router";
import { BranchHours } from "../../../../../features/branch/components/branch-hours";

/** D3c screen 17 (Branch §4.4, API 09 §1.4). */
export const Route = createFileRoute("/_app/admin/branches/$id/hours")({ component: BranchHours });
