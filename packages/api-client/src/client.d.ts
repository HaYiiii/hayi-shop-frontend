import { type Middleware } from "openapi-fetch";
import type { paths as BackofficePaths } from "./generated/backoffice.js";
import type { paths as CustomerPaths } from "./generated/customer.js";
import type { paths as PublicPaths } from "./generated/public.js";
/** Double-submit CSRF header for cookie-authenticated unsafe requests (01-security.md §3.1). */
export declare const csrfMiddleware: Middleware;
/** Generates an Idempotency-Key for commands that require it (API Contract README §7). */
export declare function newIdempotencyKey(): string;
export interface ClientOptions {
    /** API origin, e.g. https://api.hayi.vn — empty for same-origin proxy in dev. */
    baseUrl: string;
}
export declare function createPublicClient({ baseUrl }: ClientOptions): import("openapi-fetch").Client<PublicPaths, `${string}/${string}`>;
export declare function createCustomerClient({ baseUrl }: ClientOptions): import("openapi-fetch").Client<CustomerPaths, `${string}/${string}`>;
export declare function createBackofficeClient({ baseUrl }: ClientOptions): import("openapi-fetch").Client<BackofficePaths, `${string}/${string}`>;
