"use client";

import { ApiError, createCustomerClient, toProblem } from "@hayi/api-client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, createContext, use, useState } from "react";

export type CustomerClient = ReturnType<typeof createCustomerClient>;

/** Key of the signed-in Customer (`GET /auth/me`); `null` = signed out. */
export const meKey = ["auth", "me"] as const;

const ApiContext = createContext<CustomerClient | null>(null);

/**
 * Client-side providers for pages that need a Customer session (API 01-security §2: they call the API from the
 * browser). The API is reached on this origin (`/api/customer`, proxied by next.config.ts), so the HttpOnly cookies
 * and `hy_c_csrf` belong to this host. Public pages stay Server Components and do not use this.
 */
export function CustomerProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }));
  const [client] = useState(() =>
    createCustomerClient({
      baseUrl: typeof window === "undefined" ? "" : window.location.origin,
      // Refresh refused or session revoked: signed out from now on (no token is kept anywhere but cookies).
      onSessionExpired: () => queryClient.setQueryData(meKey, null),
    }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <ApiContext value={client}>{children}</ApiContext>
    </QueryClientProvider>
  );
}

export function useCustomerApi(): CustomerClient {
  const client = use(ApiContext);
  if (!client) throw new Error("useCustomerApi must be used inside <CustomerProviders>");
  return client;
}

/** Resolves to `data`, or throws an ApiError carrying the Problem `code` (and `Retry-After`, in seconds). */
export async function unwrap<T>(result: Promise<{ data?: T; error?: unknown; response: Response }>): Promise<T> {
  const { data, error, response } = await result;
  if (!response.ok) {
    const retryAfter = Number(response.headers.get("Retry-After"));
    throw new ApiError({ ...toProblem(response.status, error), ...(retryAfter > 0 && { retryAfterSeconds: retryAfter }) });
  }
  return data as T;
}

export function errorCode(error: unknown): string | undefined {
  return error instanceof ApiError ? error.code : undefined;
}
