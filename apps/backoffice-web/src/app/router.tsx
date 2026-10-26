import type { QueryClient } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  redirect,
  useNavigate,
} from "@tanstack/react-router";
import type { BackofficeClient } from "../api";
import { meQuery, rememberIdentifier } from "../features/identity/session";
import { SignIn } from "../features/identity/sign-in";
import { type StepUpGate, StepUpDialog } from "../features/identity/step-up";
import { navItems } from "../features/staff-operations/nav-items";
import { AppLayout } from "./app-layout";
import { HomeScreen, ScreenPlaceholder } from "./screens";

export interface RouterContext {
  queryClient: QueryClient;
  api: BackofficeClient;
  stepUpGate: StepUpGate;
  onSessionExpired: () => void;
}

function Root() {
  const { stepUpGate, onSessionExpired } = rootRoute.useRouteContext();
  return (
    <>
      <Outlet />
      <StepUpDialog gate={stepUpGate} onSessionRevoked={onSessionExpired} />
    </>
  );
}

function LoginScreen() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return (
    <SignIn
      onSignedIn={(identifier) => {
        rememberIdentifier(queryClient, identifier);
        void queryClient.invalidateQueries({ queryKey: ["auth", "me"] }).then(() => navigate({ to: "/" }));
      }}
    />
  );
}

const rootRoute = createRootRouteWithContext<RouterContext>()({ component: Root });

const loginRoute = createRoute({ getParentRoute: () => rootRoute, path: "/login", component: LoginScreen });

const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "app",
  beforeLoad: async ({ context }) => {
    try {
      await context.queryClient.ensureQueryData(meQuery(context.api));
    } catch {
      throw redirect({ to: "/login" });
    }
  },
  component: AppLayout,
});

const homeRoute = createRoute({ getParentRoute: () => appRoute, path: "/", component: HomeScreen });

const screenRoutes = navItems.map((item) =>
  createRoute({ getParentRoute: () => appRoute, path: item.path, component: () => <ScreenPlaceholder item={item} /> }),
);

const routeTree = rootRoute.addChildren([loginRoute, appRoute.addChildren([homeRoute, ...screenRoutes])]);

export function createAppRouter(context: RouterContext) {
  return createRouter({ routeTree, context, defaultPreload: "intent", scrollRestoration: true });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
