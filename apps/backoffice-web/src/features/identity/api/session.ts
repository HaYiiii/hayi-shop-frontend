import { queryOptions } from "@tanstack/react-query";
import { type BackofficeClient, unwrap } from "../../../lib/api";

/** The caller's account (name, email, MFA) and roles and permissions per scope (`GET /auth/me`, Decision M4). */
export function meQuery(api: BackofficeClient) {
  return queryOptions({
    queryKey: ["auth", "me"],
    queryFn: () => unwrap(api.GET("/auth/me")),
    staleTime: 60_000,
    retry: false,
  });
}
