import { ApiError, type CustomerComponents, toProblem } from "@hayi/api-client";
import { queryOptions } from "@tanstack/react-query";
import type { CustomerClient } from "../../../lib/customer-api";

export type CustomerProfile = CustomerComponents["schemas"]["CustomerProfile"];

/** The profile and the `ETag` that a change sends back as `If-Match` (API 07 §1, Decision O). */
export interface VersionedProfile {
  profile: CustomerProfile;
  etag: string | null;
}

export const profileKey = ["me", "profile"] as const;

async function versioned(result: Promise<{ data?: CustomerProfile; error?: unknown; response: Response }>): Promise<VersionedProfile> {
  const { data, error, response } = await result;
  if (!response.ok || !data) throw new ApiError(toProblem(response.status, error));
  return { profile: data, etag: response.headers.get("ETag") };
}

/** `GET /me/profile`. */
export function profileQuery(api: CustomerClient) {
  return queryOptions({
    queryKey: profileKey,
    queryFn: () => versioned(api.GET("/me/profile")),
    staleTime: 30_000,
  });
}

/** `PATCH /me/profile` (Merge Patch) against the version it was read at; a newer one answers `412`. */
export function renameProfile(api: CustomerClient, base: VersionedProfile, displayName: string) {
  return versioned(
    api.PATCH("/me/profile", {
      params: { header: { "If-Match": base.etag ?? "" } },
      headers: { "Content-Type": "application/merge-patch+json" },
      body: { displayName },
    }),
  );
}

/** Same limits as the server (API 07 §1: 1–128 characters, not blank). */
export const DISPLAY_NAME_MAX = 128;
