import type { BackofficeComponents } from "@hayi/api-client";
import { queryOptions } from "@tanstack/react-query";
import { type BackofficeClient, unwrap } from "../../../lib/api";

type Schemas = BackofficeComponents["schemas"];

export const branchKeys = {
  all: ["branches"] as const,
  list: () => [...branchKeys.all, "list"] as const,
  detail: (branchId: string) => [...branchKeys.all, "detail", branchId] as const,
  closureCheck: (branchId: string) => [...branchKeys.all, "closure-check", branchId] as const,
};

/** Every Branch in the caller's scope, sorted by `branchCode`; small and unpaged (API 09 §1.1). */
export function branchesQuery(api: BackofficeClient) {
  return queryOptions({
    queryKey: branchKeys.list(),
    queryFn: () => unwrap(api.GET("/branches")).then((list) => list.items),
  });
}

export function branchQuery(api: BackofficeClient, branchId: string) {
  return queryOptions({
    queryKey: branchKeys.detail(branchId),
    queryFn: () => unwrap(api.GET("/branches/{branchId}", { params: { path: { branchId } } })),
  });
}

/** Open commitments that block deactivate/close; always fresh (Decision P3). */
export function closureCheckQuery(api: BackofficeClient, branchId: string) {
  return queryOptions({
    queryKey: branchKeys.closureCheck(branchId),
    queryFn: () =>
      unwrap(api.GET("/branches/{branchId}/closure-check", { params: { path: { branchId } } })).then((c) => c.conflicts),
    staleTime: 0,
    gcTime: 0,
  });
}

export function createBranch(api: BackofficeClient, body: Schemas["BranchCreateRequest"]) {
  return unwrap(api.POST("/branches", { body }));
}

/** JSON Merge Patch with `If-Match: "v{version}"` (API README §8). */
export function updateBranch(api: BackofficeClient, branch: Schemas["Branch"], body: Schemas["BranchPatch"]) {
  return unwrap(
    api.PATCH("/branches/{branchId}", {
      params: { path: { branchId: branch.branchId }, header: { "If-Match": `"v${branch.version}"` } },
      body,
      headers: { "Content-Type": "application/merge-patch+json" },
    }),
  );
}

export type LifecycleCommand = "activate" | "deactivate" | "close";

/** Lifecycle command; the server checks the state machine and open commitments (API 09 §1.3). */
export function changeLifecycle(api: BackofficeClient, branchId: string, command: LifecycleCommand) {
  const options = { params: { path: { branchId } } };
  switch (command) {
    case "activate":
      return unwrap(api.POST("/branches/{branchId}/activate", options));
    case "deactivate":
      return unwrap(api.POST("/branches/{branchId}/deactivate", options));
    case "close":
      return unwrap(api.POST("/branches/{branchId}/close", options));
  }
}
