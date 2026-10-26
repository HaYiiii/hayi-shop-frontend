import { type QueryClient, queryOptions } from "@tanstack/react-query";
import { type BackofficeClient, unwrap } from "../../api";

/** The caller's roles and permissions per scope (`GET /auth/me`, Decision M4). */
export function meQuery(api: BackofficeClient) {
  return queryOptions({
    queryKey: ["auth", "me"],
    queryFn: () => unwrap(api.GET("/auth/me")),
    staleTime: 60_000,
    retry: false,
  });
}

const identifierKey = ["auth", "identifier"] as const;

/**
 * The identifier typed at sign-in, kept in the query cache (memory only) for the header until `/auth/me`
 * returns a display name (follow-up ticket). Lost on reload by design.
 */
export function rememberIdentifier(queryClient: QueryClient, identifier: string) {
  queryClient.setQueryData(identifierKey, identifier);
}

export function signedInIdentifier(queryClient: QueryClient): string | undefined {
  return queryClient.getQueryData<string>(identifierKey);
}
