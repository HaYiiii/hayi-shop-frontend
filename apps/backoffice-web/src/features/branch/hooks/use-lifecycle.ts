import { ApiError } from "@hayi/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "../../../lib/api";
import type { Branch, BranchConflict } from "../branch-form";
import { type LifecycleCommand, branchKeys, changeLifecycle, closureCheckQuery } from "../api/branches";

/** `conflicts[]` of a `409 BRANCH_HAS_OPEN_COMMITMENTS`, or `null` for any other error. */
export function openCommitmentsOf(error: unknown): BranchConflict[] | null {
  if (!(error instanceof ApiError) || error.code !== "BRANCH_HAS_OPEN_COMMITMENTS") return null;
  const conflicts = error.problem.conflicts;
  return Array.isArray(conflicts) ? (conflicts as BranchConflict[]) : [];
}

/** Runs a lifecycle command and puts the returned Branch in the cache. */
export function useLifecycle(branchId: string, command: LifecycleCommand, onDone: (branch: Branch) => void) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => changeLifecycle(api, branchId, command),
    onSuccess: (branch) => {
      queryClient.setQueryData(branchKeys.detail(branchId), branch);
      void queryClient.invalidateQueries({ queryKey: branchKeys.list() });
      onDone(branch);
    },
    onError: (error) => {
      // The command ran the same check and found commitments: show them as the check's result (Decision P3).
      const conflicts = openCommitmentsOf(error);
      if (conflicts) queryClient.setQueryData(branchKeys.closureCheck(branchId), conflicts);
    },
  });
}

/** The closure-check while a deactivate/close dialog is open; always fetched fresh. */
export function useClosureCheck(branchId: string) {
  const api = useApi();
  return useQuery(closureCheckQuery(api, branchId));
}
