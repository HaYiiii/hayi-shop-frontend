import type { CustomerComponents } from "@hayi/api-client";
import { queryOptions } from "@tanstack/react-query";
import { type CustomerClient, unwrap } from "../../../lib/customer-api";

export type DeviceSession = CustomerComponents["schemas"]["DeviceSession"];

export const sessionsKey = ["auth", "sessions"] as const;

/** `GET /auth/sessions`: this Customer's live sessions, most recently used first; `current` is this one (Decision AT1). */
export function sessionsQuery(api: CustomerClient) {
  return queryOptions({
    queryKey: sessionsKey,
    queryFn: async () => (await unwrap(api.GET("/auth/sessions"))).items,
    staleTime: 30_000,
  });
}

/** `DELETE /auth/sessions/{id}`: ends another session now (AT2); this one → `409`, unknown → `404 SESSION_NOT_FOUND`. */
export function revokeSession(api: CustomerClient, sessionId: string) {
  return unwrap(api.DELETE("/auth/sessions/{sessionId}", { params: { path: { sessionId } } }));
}
