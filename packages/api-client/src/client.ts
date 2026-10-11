import createClient, { type Middleware } from "openapi-fetch";
import type { paths as BackofficePaths } from "./generated/backoffice.js";
import type { paths as CustomerPaths } from "./generated/customer.js";
import type { paths as PublicPaths } from "./generated/public.js";

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const CSRF_COOKIE = "hy_csrf";

function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.split("; ").find((c) => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : undefined;
}

/** Double-submit CSRF header for cookie-authenticated unsafe requests (01-security.md §3.1). */
export const csrfMiddleware: Middleware = {
  onRequest({ request }) {
    if (UNSAFE_METHODS.has(request.method)) {
      const token = readCookie(CSRF_COOKIE);
      if (token) request.headers.set("X-CSRF-Token", token);
    }
    return request;
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

export function createBackofficeClient({ baseUrl }: ClientOptions) {
  const client = createClient<BackofficePaths>({ baseUrl: `${baseUrl}/api/backoffice/v1`, credentials: "include" });
  client.use(csrfMiddleware);
  return client;
}
