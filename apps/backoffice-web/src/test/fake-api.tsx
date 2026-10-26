import { createBackofficeClient } from "@hayi/api-client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { vi } from "vitest";
import { ApiProvider } from "../lib/api";

type Handler = (body: unknown, request: Request) => Response | Promise<Response>;

export const API_ORIGIN = "http://api.test";

export function problem(status: number, code: string, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify({ type: "about:blank", title: code, status, code }), {
    status,
    headers: { "Content-Type": "application/problem+json", ...headers },
  });
}

export function json(body: unknown, status = 200) {
  return Response.json(body, { status });
}

export function noContent() {
  return new Response(null, { status: 204 });
}

/**
 * Stubs global fetch with handlers keyed by "METHOD /path" (path below /api/backoffice/v1).
 * Unknown routes answer 404 so a missing handler fails loudly.
 */
export function fakeApi(handlers: Record<string, Handler>) {
  const calls: { route: string; body: unknown }[] = [];
  const fetch = vi.fn(async (request: Request) => {
    const path = new URL(request.url).pathname.replace("/api/backoffice/v1", "");
    const route = `${request.method} ${path}`;
    const text = await request.clone().text();
    const body: unknown = text ? JSON.parse(text) : undefined;
    calls.push({ route, body });
    const handler = handlers[route];
    return handler ? handler(body, request) : problem(404, "NOT_FOUND");
  });
  vi.stubGlobal("fetch", fetch);
  return {
    calls,
    bodyOf(route: string) {
      return calls.findLast((c) => c.route === route)?.body;
    },
  };
}

export function createTestWrapper(options: { onStepUpRequired?: () => Promise<void> } = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const client = createBackofficeClient({ baseUrl: API_ORIGIN, ...options });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <ApiProvider client={client}>{children}</ApiProvider>
      </QueryClientProvider>
    );
  };
}
