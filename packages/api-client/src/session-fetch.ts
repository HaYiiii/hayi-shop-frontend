import { applyCsrf } from "./csrf.js";

/** 401 codes that mean "access token missing or expired": a refresh may fix them (01-security.md §5). */
const REFRESHABLE_CODES = new Set(["AUTH_REQUIRED", "AUTH_TOKEN_EXPIRED"]);

/** The session itself is gone (refresh-token reuse §5, too many step-up failures Decision L7). */
const SESSION_REVOKED = "AUTH_SESSION_REVOKED";

/** Sign-in steps answer 401 for wrong input or step tokens; refreshing would only hide that. */
const SIGN_IN_PATHS = new Set(["/auth/login", "/auth/refresh", "/auth/logout", "/auth/password/first-change"]);
const SIGN_IN_PREFIX = "/auth/mfa/";

export interface SessionFetchOptions {
  /** Absolute or same-origin base URL of the surface, e.g. `/api/backoffice/v1`. */
  apiUrl: string;
  fetch?: (request: Request) => Promise<Response>;
  /** The session is over (refresh rejected or session revoked): the user must sign in again. Fired once. */
  onSessionExpired?: () => void;
  /**
   * An action answered `403 STEP_UP_REQUIRED` (01-security.md §8). Resolve once the user has stepped up
   * to replay the request (same `Idempotency-Key`); reject to give up and return the 403.
   */
  onStepUpRequired?: () => Promise<void>;
}

type RefreshOutcome = "refreshed" | "expired" | "unavailable";

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
 * requests) and replays; on `CSRF_INVALID` it re-issues the CSRF cookie and replays; on
 * `STEP_UP_REQUIRED` it waits for the step-up and replays.
 */
export function createSessionFetch({
  apiUrl,
  fetch: baseFetch = (request) => globalThis.fetch(request),
  onSessionExpired,
  onStepUpRequired,
}: SessionFetchOptions) {
  const basePath = new URL(apiUrl, "http://base.invalid").pathname;
  let refreshing: Promise<RefreshOutcome> | null = null;
  let reissuing: Promise<boolean> | null = null;
  let ended = false;

  /** Every successful answer means a live session again, so a later end is reported again. */
  async function send(request: Request): Promise<Response> {
    const response = await baseFetch(request);
    if (response.ok) ended = false;
    return response;
  }

  function endSession() {
    if (ended) return;
    ended = true;
    onSessionExpired?.();
  }

  /** `GET /auth/csrf` sets a fresh `hy_csrf` for the current session (§3.1). */
  function reissueCsrf(): Promise<boolean> {
    reissuing ??= baseFetch(new Request(`${apiUrl}/auth/csrf`, { credentials: "include" }))
      .then((res) => res.ok, () => false)
      .finally(() => {
        reissuing = null;
      });
    return reissuing;
  }

  async function attemptRefresh(): Promise<RefreshOutcome> {
    const post = () => baseFetch(applyCsrf(new Request(`${apiUrl}/auth/refresh`, { method: "POST", credentials: "include" })));
    let res = await post();
    if (res.status === 403 && (await problemCode(res)) === "CSRF_INVALID" && (await reissueCsrf())) res = await post();
    if (res.ok) return "refreshed";
    // Only the server saying "no session" ends it; a network error, 429 or 5xx may pass.
    return res.status === 401 ? "expired" : "unavailable";
  }

  function refresh(): Promise<RefreshOutcome> {
    refreshing ??= attemptRefresh()
      .catch((): RefreshOutcome => "unavailable")
      .then((outcome) => {
        if (outcome === "expired") endSession();
        return outcome;
      })
      .finally(() => {
        refreshing = null;
      });
    return refreshing;
  }

  return async function sessionFetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.startsWith(basePath) ? url.pathname.slice(basePath.length) : url.pathname;
    const signInStep = SIGN_IN_PATHS.has(path) || path.startsWith(SIGN_IN_PREFIX);
    const copy = request.clone();
    const replay = () => send(applyCsrf(copy.clone()));
    let response = await send(request);

    if (response.status === 403 && (await problemCode(response)) === "CSRF_INVALID" && (await reissueCsrf())) {
      response = await replay();
    }

    if (response.status === 401 && !signInStep) {
      const code = await problemCode(response);
      if (code === SESSION_REVOKED) {
        endSession();
        return response;
      }
      if (!REFRESHABLE_CODES.has(code ?? "")) return response;
      if ((await refresh()) !== "refreshed") return response;
      response = await replay();
    }

    if (response.status === 403 && onStepUpRequired && (await problemCode(response)) === "STEP_UP_REQUIRED") {
      try {
        await onStepUpRequired();
      } catch {
        return response;
      }
      response = await replay();
    }

    return response;
  };
}
