import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link, Outlet, createFileRoute, redirect, useNavigate, useParams } from "@tanstack/react-router";
import { Button } from "@hayi/ui";
import { useMemo, useState } from "react";
import { meQuery, signedInIdentifier } from "../features/identity/api/session";
import { AccountMenu, AppShell, Brand } from "../features/staff/components/app-shell";
import { NavMenu, navLinkClass } from "../features/staff/components/nav-menu";
import { unwrap, useApi } from "../lib/api";
import { BranchSwitcher } from "../lib/branch-switcher";
import { type Scope, initialScope, permissionsIn, readLastBranch, writeLastBranch } from "../lib/scope";
import { WorkspaceProvider } from "../lib/workspace";

/** Signed-in frame: needs `/auth/me` (the client refreshes an expired session first). */
export const Route = createFileRoute("/_app")({
  beforeLoad: async ({ context }) => {
    try {
      await context.queryClient.ensureQueryData(meQuery(context.api));
    } catch {
      throw redirect({ to: "/login" });
    }
  },
  component: AppLayout,
});

function AppLayout() {
  const api = useApi();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: me } = useSuspenseQuery(meQuery(api));
  // A Branch in the URL is the scope (SOURCE-STRUCTURE §3.1); elsewhere the last chosen one applies.
  const routeBranch = useParams({ strict: false }).branchId;
  const [chosen, setChosen] = useState<Scope | null>(null);
  if (routeBranch && !(chosen?.kind === "branch" && chosen.branchId === routeBranch)) {
    setChosen({ kind: "branch", branchId: routeBranch });
  }
  // A scope the user lost (role revoked, /me refetched) falls back to the default.
  const scope = useMemo((): Scope | null => {
    if (routeBranch) return { kind: "branch", branchId: routeBranch };
    if (chosen?.kind === "store") return me.storeRoles.length > 0 ? chosen : initialScope(me, readLastBranch());
    return initialScope(me, chosen?.branchId ?? readLastBranch());
  }, [me, chosen, routeBranch]);
  const permissions = useMemo(() => (scope ? permissionsIn(me, scope) : new Set<string>()), [me, scope]);

  async function logout() {
    await unwrap(api.POST("/auth/logout")).catch(() => undefined);
    queryClient.clear();
    await navigate({ to: "/login" });
  }

  function changeScope(next: Scope) {
    setChosen(next);
    writeLastBranch(next);
    if (!routeBranch) return;
    // On a Branch screen: the same screen at the new Branch, or home for the store-wide scope.
    if (next.kind === "branch") void navigate({ to: ".", params: { branchId: next.branchId } });
    else void navigate({ to: "/" });
  }

  if (!scope) {
    return (
      <main className="grid min-h-dvh place-items-center bg-cream px-4 text-center">
        <div className="grid max-w-[40ch] gap-3">
          <h1 className="font-display text-heading-lg">Tài khoản chưa được giao chi nhánh</h1>
          <p className="text-body text-ink-muted">Nhờ quản lý giao chi nhánh và vai trò cho bạn, rồi đăng nhập lại.</p>
          <Button variant="link" className="justify-self-center" onClick={logout}>
            Đăng xuất
          </Button>
        </div>
      </main>
    );
  }

  return (
    <WorkspaceProvider value={{ me, scope, permissions }}>
      <AppShell
        brand={
          <Link
            to="/"
            aria-label="HaYi Shop Backoffice — trang chính"
            className="rounded-md no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            <Brand />
          </Link>
        }
        scope={<BranchSwitcher me={me} scope={scope} onScopeChange={changeScope} />}
        account={<AccountMenu name={signedInIdentifier(queryClient) ?? "Tài khoản của bạn"} onLogout={logout} />}
        nav={
          <NavMenu
            scope={scope}
            permissions={permissions}
            renderLink={(item) => {
              const content = (
                <>
                  {item.icon}
                  <span>{item.label}</span>
                </>
              );
              return item.level === "branch" && scope.kind === "branch" ? (
                <Link to={item.to} params={{ branchId: scope.branchId }} className={navLinkClass}>
                  {content}
                </Link>
              ) : (
                <Link to={item.to} className={navLinkClass}>
                  {content}
                </Link>
              );
            }}
          />
        }
      >
        <Outlet />
      </AppShell>
    </WorkspaceProvider>
  );
}
