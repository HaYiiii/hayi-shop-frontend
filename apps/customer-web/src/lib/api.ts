import { createPublicClient } from "@hayi/api-client";

/**
 * How long the Next.js server reuses a public API answer (Decision X1). Every server render calls the API from the
 * server's one IP, and the public API allows 120 requests per minute per IP (W9): without this cache the whole site
 * would share that budget. Branch status and earliest pickup may lag by up to this long; ordering checks slots again.
 */
export const PUBLIC_REVALIDATE_SECONDS = 60;

/**
 * Public API client for Server Components (`/api/public/v1`, no session).
 * `HAYI_API_ORIGIN` is the backend origin as the Next.js server reaches it; not a secret.
 */
export function publicApi() {
  return createPublicClient({
    baseUrl: process.env.HAYI_API_ORIGIN ?? "http://localhost:8080",
    requestInitExt: { next: { revalidate: PUBLIC_REVALIDATE_SECONDS } },
  });
}
