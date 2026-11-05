import type { BackofficeComponents } from "@hayi/api-client";
import { queryOptions } from "@tanstack/react-query";
import { type BackofficeClient, unwrap } from "../../../lib/api";

type Schemas = BackofficeComponents["schemas"];
export type FulfillmentConfig = Schemas["FulfillmentConfig"];
export type PickupSchedule = Schemas["PickupSchedule"];
export type CapacityView = Schemas["CapacityView"];

/** The schedule and the config `version` from its `ETag`: one aggregate, one version (Decision S1). */
export interface VersionedSchedule {
  schedule: PickupSchedule;
  version: number;
}

const PICKUP = "PICKUP" as const;

export const fulfillmentKeys = {
  all: ["fulfillment"] as const,
  config: (branchId: string) => [...fulfillmentKeys.all, "config", branchId] as const,
  schedule: (branchId: string) => [...fulfillmentKeys.all, "schedule", branchId] as const,
  capacity: (branchId: string, date: string) => [...fulfillmentKeys.all, "capacity", branchId, date] as const,
};

function versionOf(response: Response): number {
  const match = /^"v(\d+)"$/.exec(response.headers.get("ETag") ?? "");
  if (!match) throw new Error("Fulfillment response without an ETag");
  return Number(match[1]);
}

/** PICKUP's config; never saved → defaults with `version: 0` (Decision R1). */
export function configQuery(api: BackofficeClient, branchId: string) {
  return queryOptions({
    queryKey: fulfillmentKeys.config(branchId),
    queryFn: async () => {
      const list = await unwrap(api.GET("/branches/{branchId}/fulfillment/configs", { params: { path: { branchId } } }));
      const pickup = list.items.find((c) => c.fulfillmentType === PICKUP);
      if (!pickup) throw new Error("No PICKUP config");
      return pickup;
    },
  });
}

async function versioned(call: Promise<{ data?: PickupSchedule; error?: unknown; response: Response }>): Promise<VersionedSchedule> {
  const result = await call;
  const schedule = await unwrap(Promise.resolve(result));
  return { schedule, version: versionOf(result.response) };
}

/** Weekly windows and overrides from today (Decision S4). */
export function scheduleQuery(api: BackofficeClient, branchId: string) {
  return queryOptions({
    queryKey: fulfillmentKeys.schedule(branchId),
    queryFn: () =>
      versioned(
        api.GET("/branches/{branchId}/fulfillment/configs/{fulfillmentType}/schedule", {
          params: { path: { branchId, fulfillmentType: PICKUP } },
        }),
      ),
  });
}

/** Slots of one day with the real numbers (Decision V1); always fresh. */
export function capacityQuery(api: BackofficeClient, branchId: string, date: string) {
  return queryOptions({
    queryKey: fulfillmentKeys.capacity(branchId, date),
    queryFn: () =>
      unwrap(
        api.GET("/branches/{branchId}/fulfillment/capacity", {
          params: { path: { branchId }, query: { date, fulfillmentType: PICKUP } },
        }),
      ),
    staleTime: 0,
  });
}

/** Replaces the whole config; `If-Match` required, `"v0"` creates it (Decision R2). */
export async function saveConfig(api: BackofficeClient, branchId: string, version: number, body: Schemas["FulfillmentConfigInput"]) {
  const config = await unwrap(
    api.PUT("/branches/{branchId}/fulfillment/configs/{fulfillmentType}", {
      params: { path: { branchId, fulfillmentType: PICKUP }, header: { "If-Match": `"v${version}"` } },
      body,
    }),
  );
  return config;
}

/** Replaces the whole week; `If-Match` required (Decision S2). */
export function replaceWeeklySchedule(
  api: BackofficeClient,
  branchId: string,
  version: number,
  body: Schemas["WeeklyScheduleReplaceRequest"],
) {
  return versioned(
    api.PUT("/branches/{branchId}/fulfillment/configs/{fulfillmentType}/weekly-schedule", {
      params: { path: { branchId, fulfillmentType: PICKUP }, header: { "If-Match": `"v${version}"` } },
      body,
    }),
  );
}

/** Replaces every override of that date; `If-Match` optional and not sent (Decision S3). */
export function putOverride(api: BackofficeClient, branchId: string, body: Schemas["ScheduleOverrideRequest"]) {
  return versioned(
    api.POST("/branches/{branchId}/fulfillment/configs/{fulfillmentType}/overrides", {
      params: { path: { branchId, fulfillmentType: PICKUP } },
      body,
    }),
  );
}

/** Deletes one override, i.e. one window of a date (Decision S3, S7). */
export function deleteOverride(api: BackofficeClient, branchId: string, overrideId: string) {
  return versioned(
    api.DELETE("/branches/{branchId}/fulfillment/configs/{fulfillmentType}/overrides/{overrideId}", {
      params: { path: { branchId, fulfillmentType: PICKUP, overrideId } },
    }),
  );
}
