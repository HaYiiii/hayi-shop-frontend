import { createFileRoute } from "@tanstack/react-router";
import { BranchInfo } from "../../../../../features/branch/components/branch-detail";

export const Route = createFileRoute("/_app/admin/branches/$id/")({ component: BranchInfo });
