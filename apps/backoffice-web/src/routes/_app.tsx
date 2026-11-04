import { ApiError } from "@hayi/api-client";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link, Outlet, createFileRoute, redirect, useNavigate, useParams, useRouter } from "@tanstack/react-router";
import { Button } from "@hayi/ui";
import { useMemo, useState } from "react";
import { branchesQuery } from "../features/branch/api/branches";
import { branchDirectory } from "../features/branch/branch-directory";
import { meQuery } from "../features/identity/api/session";
import { AccountMenu, AppShell, Brand } from "../features/staff/components/app-shell";
import { NavMenu, navLinkClass } from "../features/staff/components/nav-menu";
import { unwrap, useApi } from "../lib/api";
import { BranchSwitcher } from "../lib/branch-switcher";
import { type BranchNames, type Scope, initialScope, permissionsIn, readLastBranch, writeLastBranch } from "../lib/scope";
import { WorkspaceProvider } from "../lib/workspace";

/** Signed-in frame: needs `/auth/me` (the client refreshes an expired session first). */
export const Route = createFileRoute("/_app")({
  beforeLoad: async ({ context }) => {
    let me;
    try {
      me = await context.queryClient.ensureQueryData(meQuery(context.api));
    } catch (error) {
      // Only "no session" means sign in again; a network error or 5xx leaves the session alive.
      if (error instanceof ApiError && error.status === 401) throw redirect({ to: "/login" });
      throw error;
    }
    // The branch switcher names the user's Branches (API 09 §1.1: every role has BRANCH_VIEW).
    if (me.branches.length > 0) await context.queryClient.ensureQueryData(directoryQuery(context.api));
  },
  component: AppLayout,
  errorComponent: AppLoadError,
});

/** Shared with the Branch admin list; the header needs no fresher names than this. */
function directoryQuery(api: Parameters<typeof branchesQuery>[0]) {
  return { ...branchesQuery(api), staleTime: 60_000 };
}

function AppLoadError() {
  const router = useRouter();
  return (
    <main className="grid min-h-dvh place-items-center bg-cream px-4 text-center">
      <div role="alert" className="grid max-w-[40ch] gap-3">
        <h1 className="font-display text-heading-lg">Chưa tải được Backoffice</h1>
        <p className="text-body text-ink-muted">Không kết nối được máy chủ hoặc hệ thống đang bận. Kiểm tra mạng rồi thử lại.</p>
        <Button className="justify-self-center" onClick={() => void router.invalidate()}>
          Thử lại
        </Button>
      </div>
    </main>
  );
}

function AppLayout() {
  const api = useApi();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: me } = useSuspenseQuery(meQuery(api));
  // A Branch in the URL is the scope (SOURCE-STRUCTURE §3.1); elsewhere the last chosen one applies.
  const routeBranch = useParams({ strict: false }).branchId;
  // Loaded before the layout when the user has Branches; a STORE role opening a Branch URL loads it here.
  const branchList = useQuery({ ...directoryQuery(api), enabled: me.branches.length > 0 || routeBranch !== undefined });
  const branches = useMemo(
    (): BranchNames => (branchList.data ? branchDirectory(branchList.data) : branchList.isError ? "failed" : "loading"),
    [branchList.data, branchList.isError],
  );
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
          <Button variant="link" className="justify-self-center" onClick={() => void logout()}>
            Đăng xuất
          </Button>
        </div>
      </main>
    );
  }

  return (
    <WorkspaceProvider value={{ me, branches, scope, permissions }}>
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
        scope={<BranchSwitcher me={me} branches={branches} scope={scope} onScopeChange={changeScope} />}
        account={<AccountMenu name={me.displayName ?? me.email ?? "Tài khoản của bạn"} onLogout={() => void logout()} />}
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
