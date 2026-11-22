const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** The CSRF cookie of each cookie surface: one per surface, so both apps can run in one browser (Decision AP1). */
export const CSRF_COOKIES = {
  backoffice: "hy_b_csrf",
  customer: "hy_c_csrf",
} as const;

export type CsrfCookie = (typeof CSRF_COOKIES)[keyof typeof CSRF_COOKIES];

function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.split("; ").find((c) => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : undefined;
}

/** Sets `X-CSRF-Token` from the surface's CSRF cookie on unsafe methods (01-security.md §3.1). */
export function applyCsrf(request: Request, cookie: CsrfCookie): Request {
  if (UNSAFE_METHODS.has(request.method)) {
    const token = readCookie(cookie);
    if (token) request.headers.set("X-CSRF-Token", token);
  }
  return request;
}
