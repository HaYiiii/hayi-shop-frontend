import createClient, { type Middleware } from "openapi-fetch";
import { applyCsrf } from "./csrf.js";
import type { paths as BackofficePaths } from "./generated/backoffice.js";
import type { paths as CustomerPaths } from "./generated/customer.js";
import type { paths as PublicPaths } from "./generated/public.js";
import { createSessionFetch, type SessionFetchOptions } from "./session-fetch.js";

/** Double-submit CSRF header for cookie-authenticated unsafe requests (01-security.md §3.1). */
export const csrfMiddleware: Middleware = {
  onRequest({ request }) {
    return applyCsrf(request);
  },
};

/** Generates an Idempotency-Key for commands that require it (API Contract README §7). */
export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}

export interface ClientOptions {
  /** API origin, e.g. https://api.hayi.vn — empty for same-origin proxy in dev. */
  baseUrl: string;
}

export function createPublicClient({ baseUrl }: ClientOptions) {
  return createClient<PublicPaths>({ baseUrl: `${baseUrl}/api/public/v1` });
}

export function createCustomerClient({ baseUrl }: ClientOptions) {
  const client = createClient<CustomerPaths>({ baseUrl: `${baseUrl}/api/customer/v1`, credentials: "include" });
  client.use(csrfMiddleware);
  return client;
}

export type BackofficeClientOptions = ClientOptions &
  Pick<SessionFetchOptions, "onSessionExpired" | "onStepUpRequired">;

/** Refreshes an expired session once and replays; re-issues CSRF; hands `STEP_UP_REQUIRED` to `onStepUpRequired`. */
export function createBackofficeClient({ baseUrl, onSessionExpired, onStepUpRequired }: BackofficeClientOptions) {
  const apiUrl = `${baseUrl}/api/backoffice/v1`;
  const fetch = createSessionFetch({ apiUrl, onSessionExpired, onStepUpRequired });
  const client = createClient<BackofficePaths>({ baseUrl: apiUrl, credentials: "include", fetch });
  client.use(csrfMiddleware);
  return client;
}
