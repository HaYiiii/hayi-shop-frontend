import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "../../../lib/api";
import { type VersionedHours, hoursKey, hoursQuery } from "../api/hours";
import { branchKeys } from "../api/branches";

export function useHours(branchId: string) {
  const api = useApi();
  return useQuery(hoursQuery(api, branchId));
}

/**
 * An edit of the hours: the answer carries the new hours and Branch version, so the cache takes them as they are;
 * the Branch itself is refetched because its `version` moved too (Decision Q1).
 */
export function useHoursMutation<T>(branchId: string, edit: (variables: T) => Promise<VersionedHours>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: edit,
    onSuccess: (result) => {
      queryClient.setQueryData(hoursKey(branchId), result);
      void queryClient.invalidateQueries({ queryKey: branchKeys.detail(branchId) });
    },
  });
}
