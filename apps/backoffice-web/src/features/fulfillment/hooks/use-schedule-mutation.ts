import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type VersionedSchedule, fulfillmentKeys } from "../api/fulfillment";

/**
 * A change of the schedule: the answer carries the schedule and the config's new version (one aggregate, S1),
 * so the cache takes it as it is; the config (its `version`) and the slot preview are refetched.
 */
export function useScheduleMutation<T>(branchId: string, change: (variables: T) => Promise<VersionedSchedule>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: change,
    onSuccess: (result) => {
      queryClient.setQueryData(fulfillmentKeys.schedule(branchId), result);
      void queryClient.invalidateQueries({ queryKey: fulfillmentKeys.config(branchId) });
      void queryClient.invalidateQueries({ queryKey: [...fulfillmentKeys.all, "capacity", branchId] });
    },
  });
}
