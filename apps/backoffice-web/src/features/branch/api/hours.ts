import type { BackofficeComponents } from "@hayi/api-client";
import { queryOptions } from "@tanstack/react-query";
import { type BackofficeClient, unwrap } from "../../../lib/api";
import { branchKeys } from "./branches";

type Schemas = BackofficeComponents["schemas"];
type BranchBusinessHours = Schemas["BranchBusinessHours"];

/** The hours and the Branch `version` from the `ETag`, for `If-Match` on the next edit (Decision Q1, Q4). */
export interface VersionedHours {
  hours: BranchBusinessHours;
  version: number;
}

export const hoursKey = (branchId: string) => [...branchKeys.all, "hours", branchId] as const;

function versionOf(response: Response): number {
  const match = /^"v(\d+)"$/.exec(response.headers.get("ETag") ?? "");
  if (!match) throw new Error("Business hours response without an ETag");
  return Number(match[1]);
}

async function versioned(
  call: Promise<{ data?: BranchBusinessHours; error?: unknown; response: Response }>,
): Promise<VersionedHours> {
  const result = await call;
  const hours = await unwrap(Promise.resolve(result));
  return { hours, version: versionOf(result.response) };
}

export function hoursQuery(api: BackofficeClient, branchId: string) {
  return queryOptions({
    queryKey: hoursKey(branchId),
    queryFn: () => versioned(api.GET("/branches/{branchId}/business-hours", { params: { path: { branchId } } })),
  });
}

/** Replaces the whole week; `If-Match` is required (API 09 §1.4). */
export function replaceWeekly(api: BackofficeClient, branchId: string, version: number, body: Schemas["BusinessHoursReplaceRequest"]) {
  return versioned(
    api.PUT("/branches/{branchId}/business-hours", {
      params: { path: { branchId }, header: { "If-Match": `"v${version}"` } },
      body,
    }),
  );
}

/** Adds or replaces the override of that date; `If-Match` is optional and not sent (Decision Q1, Q3). */
export function putOverride(api: BackofficeClient, branchId: string, body: Schemas["HourOverrideRequest"]) {
  return versioned(api.POST("/branches/{branchId}/business-hour-overrides", { params: { path: { branchId } }, body }));
}

export function deleteOverride(api: BackofficeClient, branchId: string, date: string) {
  return versioned(
    api.DELETE("/branches/{branchId}/business-hour-overrides/{date}", { params: { path: { branchId, date } } }),
  );
}
