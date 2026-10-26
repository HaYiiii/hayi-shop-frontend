import { applyCsrf } from "./csrf.js";

/** 401 codes that mean "access token missing or expired": a refresh may fix them (01-security.md §5). */
const REFRESHABLE_CODES = new Set(["AUTH_REQUIRED", "AUTH_TOKEN_EXPIRED"]);

/** Sign-in steps answer 401 for wrong input or tokens; refreshing would only hide that. */
const NO_REFRESH_PATHS = [
  "/auth/login",
  "/auth/refresh",
  "/auth/logout",
  "/auth/mfa/",
  "/auth/password/first-change",
  "/auth/step-up",
];

export interface SessionFetchOptions {
  /** Absolute URL of `POST /auth/refresh` for this surface. */
  refreshUrl: string;
  fetch?: (request: Request) => Promise<Response>;
  /** The refresh failed: the session is over and the user must sign in again. */
  onSessionExpired?: () => void;
  /**
   * An action answered `403 STEP_UP_REQUIRED` (01-security.md §8). Resolve once the user has stepped up
   * to replay the request (same `Idempotency-Key`); reject to give up and return the 403.
   */
  onStepUpRequired?: () => Promise<void>;
}

async function problemCode(response: Response): Promise<string | undefined> {
  try {
    const body: unknown = await response.clone().json();
    return body && typeof body === "object" && "code" in body ? String(body.code) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * `fetch` for cookie sessions: on an expired access token it refreshes once (shared by concurrent
 * requests) and replays; on `STEP_UP_REQUIRED` it waits for the step-up and replays.
 */
export function createSessionFetch({
  refreshUrl,
  fetch: baseFetch = (request) => globalThis.fetch(request),
  onSessionExpired,
  onStepUpRequired,
}: SessionFetchOptions) {
  let refreshing: Promise<boolean> | null = null;

  function refresh(): Promise<boolean> {
    refreshing ??= baseFetch(applyCsrf(new Request(refreshUrl, { method: "POST", credentials: "include" })))
      .then((res) => res.ok, () => false)
      .finally(() => {
        refreshing = null;
      });
    return refreshing;
  }

  function replay(copy: Request): Promise<Response> {
    return baseFetch(applyCsrf(copy));
  }

  return async function sessionFetch(request: Request): Promise<Response> {
    const path = new URL(request.url).pathname;
    const copy = request.clone();
    const response = await baseFetch(request);

    if (response.status === 401 && !NO_REFRESH_PATHS.some((p) => path.includes(p))) {
      if (!REFRESHABLE_CODES.has((await problemCode(response)) ?? "")) return response;
      if (await refresh()) return replay(copy);
      onSessionExpired?.();
      return response;
    }

    if (response.status === 403 && onStepUpRequired && (await problemCode(response)) === "STEP_UP_REQUIRED") {
      try {
        await onStepUpRequired();
      } catch {
        return response;
      }
      return replay(copy);
    }

    return response;
  };
}
