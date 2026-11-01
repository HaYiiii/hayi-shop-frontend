import type { QueryClient } from "@tanstack/react-query";
import { Outlet, createRootRouteWithContext } from "@tanstack/react-router";
import type { StepUpGate } from "../features/identity/api/step-up-gate";
import { StepUpDialog } from "../features/identity/components/step-up";
import type { BackofficeClient } from "../lib/api";

export interface RouterContext {
  queryClient: QueryClient;
  api: BackofficeClient;
  stepUpGate: StepUpGate;
}

export const Route = createRootRouteWithContext<RouterContext>()({ component: Root });

function Root() {
  const { stepUpGate } = Route.useRouteContext();
  return (
    <>
      <Outlet />
      <StepUpDialog gate={stepUpGate} />
    </>
  );
}
