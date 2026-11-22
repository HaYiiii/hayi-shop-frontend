import type { CustomerComponents } from "@hayi/api-client";
import { ApiError } from "@hayi/api-client";
import { queryOptions } from "@tanstack/react-query";
import { type CustomerClient, meKey, unwrap } from "../../../lib/customer-api";

export type CustomerMe = CustomerComponents["schemas"]["CustomerMe"];

/**
 * The signed-in Customer (`GET /auth/me`, Decision AO2), or `null` when signed out. A `401` here has already been
 * through one refresh (API 01-security §5), so it means "no session".
 */
export function meQuery(api: CustomerClient) {
  return queryOptions({
    queryKey: meKey,
    queryFn: async (): Promise<CustomerMe | null> => {
      try {
        return await unwrap(api.GET("/auth/me"));
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }
    },
    staleTime: 60_000,
  });
}

/** Login form → `POST /auth/login`; sets the session cookies (Decision AO1). */
export function logIn(api: CustomerClient, body: { phone: string; password: string }) {
  return unwrap(api.POST("/auth/login", { body }));
}

/** `POST /auth/logout`: revokes this session and clears the Customer cookies. */
export function logOut(api: CustomerClient) {
  return unwrap(api.POST("/auth/logout"));
}

/** Where to go after sign-in: only a path on this site (never `//host` or `https://…`). */
export function safeNext(next: string | undefined, fallback = "/account"): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : fallback;
}
