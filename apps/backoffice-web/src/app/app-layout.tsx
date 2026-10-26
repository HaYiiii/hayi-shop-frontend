import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { unwrap, useApi } from "../api";
import { meQuery, signedInIdentifier } from "../features/identity/session";
import { AppShell } from "../features/staff-operations/app-shell";
import { navLinkClass } from "../features/staff-operations/nav-menu";
import { WorkspaceProvider, readLastBranch, writeLastBranch } from "../features/staff-operations/workspace-context";
import { type Scope, initialScope, permissionsIn } from "../features/staff-operations/workspace-scope";

/** Signed-in frame: `/auth/me` is loaded by the route's `beforeLoad`. */
export function AppLayout() {
  const api = useApi();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: me } = useSuspenseQuery(meQuery(api));
  const [chosen, setChosen] = useState<Scope | null>(null);
  // A scope the user lost (role revoked, /me refetched) falls back to the default.
  const scope = useMemo(() => {
    const preferred = chosen?.kind === "branch" ? chosen.branchId : readLastBranch();
    const fallback = initialScope(me, preferred);
    return chosen?.kind === "store" && me.storeRoles.length > 0 ? chosen : fallback;
  }, [me, chosen]);
  const permissions = useMemo(() => (scope ? permissionsIn(me, scope) : new Set<string>()), [me, scope]);

  async function logout() {
    await unwrap(api.POST("/auth/logout")).catch(() => undefined);
    queryClient.clear();
    await navigate({ to: "/login" });
  }

  if (!scope) {
    return (
      <main className="grid min-h-dvh place-items-center bg-cream px-4 text-center">
        <div className="grid max-w-[40ch] gap-3">
          <h1 className="font-display text-heading-lg">Tài khoản chưa được giao chi nhánh</h1>
          <p className="text-body text-ink-muted">Nhờ quản lý giao chi nhánh và vai trò cho bạn, rồi đăng nhập lại.</p>
          <button type="button" className="cursor-pointer text-body font-medium text-matcha-700 hover:underline" onClick={logout}>
            Đăng xuất
          </button>
        </div>
      </main>
    );
  }

  return (
    <WorkspaceProvider value={{ me, scope, permissions }}>
      <AppShell
        me={me}
        scope={scope}
        onScopeChange={(next) => {
          setChosen(next);
          writeLastBranch(next);
        }}
        accountName={signedInIdentifier(queryClient) ?? "Tài khoản của bạn"}
        onLogout={logout}
        homeLink={(content) => (
          <Link to="/" aria-label="HaYi Shop Backoffice — trang chính" className="rounded-md no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
            {content}
          </Link>
        )}
        renderLink={(item) => (
          <Link to={item.path} className={navLinkClass}>
            {item.icon}
            <span>{item.label}</span>
          </Link>
        )}
      >
        <Outlet />
      </AppShell>
    </WorkspaceProvider>
  );
}
