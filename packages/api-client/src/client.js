import createClient, {} from "openapi-fetch";
const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const CSRF_COOKIE = "hy_csrf";
function readCookie(name) {
    if (typeof document === "undefined")
        return undefined;
    const match = document.cookie.split("; ").find((c) => c.startsWith(`${name}=`));
    return match ? decodeURIComponent(match.slice(name.length + 1)) : undefined;
}
/** Double-submit CSRF header for cookie-authenticated unsafe requests (01-security.md §3.1). */
export const csrfMiddleware = {
    onRequest({ request }) {
        if (UNSAFE_METHODS.has(request.method)) {
            const token = readCookie(CSRF_COOKIE);
            if (token)
                request.headers.set("X-CSRF-Token", token);
        }
        return request;
    },
};
/** Generates an Idempotency-Key for commands that require it (API Contract README §7). */
export function newIdempotencyKey() {
    return crypto.randomUUID();
}
export function createPublicClient({ baseUrl }) {
    return createClient({ baseUrl: `${baseUrl}/api/public/v1` });
}
export function createCustomerClient({ baseUrl }) {
    const client = createClient({ baseUrl: `${baseUrl}/api/customer/v1`, credentials: "include" });
    client.use(csrfMiddleware);
    return client;
}
export function createBackofficeClient({ baseUrl }) {
    const client = createClient({ baseUrl: `${baseUrl}/api/backoffice/v1`, credentials: "include" });
    client.use(csrfMiddleware);
    return client;
}
