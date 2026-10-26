import { ApiError, type createBackofficeClient, toProblem } from "@hayi/api-client";
import { type ReactNode, createContext, use } from "react";

export type BackofficeClient = ReturnType<typeof createBackofficeClient>;

const ApiContext = createContext<BackofficeClient | null>(null);

export function ApiProvider({ client, children }: { client: BackofficeClient; children: ReactNode }) {
  return <ApiContext value={client}>{children}</ApiContext>;
}

export function useApi(): BackofficeClient {
  const client = use(ApiContext);
  if (!client) throw new Error("useApi must be used inside <ApiProvider>");
  return client;
}

/** Resolves to `data`, or throws an ApiError carrying the Problem `code` (and `Retry-After`, in seconds). */
export async function unwrap<T>(result: Promise<{ data?: T; error?: unknown; response: Response }>): Promise<T> {
  const { data, error, response } = await result;
  if (!response.ok) {
    const retryAfter = Number(response.headers.get("Retry-After"));
    throw new ApiError({
      ...toProblem(response.status, error),
      ...(retryAfter > 0 && { retryAfterSeconds: retryAfter }),
    });
  }
  return data as T;
}

export function errorCode(error: unknown): string | undefined {
  return error instanceof ApiError ? error.code : undefined;
}
