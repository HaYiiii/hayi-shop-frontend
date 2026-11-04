import { createPublicClient } from "@hayi/api-client";

/**
 * Public API client for Server Components (`/api/public/v1`, no session).
 * `HAYI_API_ORIGIN` is the backend origin as the Next.js server reaches it; not a secret.
 */
export function publicApi() {
  return createPublicClient({ baseUrl: process.env.HAYI_API_ORIGIN ?? "http://localhost:8080" });
}
