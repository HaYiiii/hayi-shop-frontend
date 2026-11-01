import { type RouterHistory, createRouter } from "@tanstack/react-router";
import { routeTree } from "../routeTree.gen";
import type { RouterContext } from "../routes/__root";

/** `history` defaults to the browser's; tests pass a memory history. */
export function createAppRouter(context: RouterContext, history?: RouterHistory) {
  return createRouter({ routeTree, context, defaultPreload: "intent", scrollRestoration: true, ...(history && { history }) });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
