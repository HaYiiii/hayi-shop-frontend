const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const CSRF_COOKIE = "hy_csrf";

function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.split("; ").find((c) => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : undefined;
}

/** Sets `X-CSRF-Token` from the `hy_csrf` cookie on unsafe methods (01-security.md §3.1). */
export function applyCsrf(request: Request): Request {
  if (UNSAFE_METHODS.has(request.method)) {
    const token = readCookie(CSRF_COOKIE);
    if (token) request.headers.set("X-CSRF-Token", token);
  }
  return request;
}
