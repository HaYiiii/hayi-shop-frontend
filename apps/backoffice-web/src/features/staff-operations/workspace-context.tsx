import { type ReactNode, createContext, use } from "react";
import type { Me, Scope } from "./workspace-scope";

interface Workspace {
  me: Me;
  scope: Scope;
  permissions: ReadonlySet<string>;
}

const WorkspaceContext = createContext<Workspace | null>(null);

export function WorkspaceProvider({ value, children }: { value: Workspace; children: ReactNode }) {
  return <WorkspaceContext value={value}>{children}</WorkspaceContext>;
}

/** Current user, scope and the permissions in force there, for screens inside the shell. */
export function useWorkspace(): Workspace {
  const workspace = use(WorkspaceContext);
  if (!workspace) throw new Error("useWorkspace must be used inside <WorkspaceProvider>");
  return workspace;
}

const PREFERENCE_KEY = "hayi.backoffice.lastBranchId";

/** Last-used Branch is a UI preference only (Staff Operations §16.2); storage may be unavailable. */
export function readLastBranch(): string | null {
  try {
    return localStorage.getItem(PREFERENCE_KEY);
  } catch {
    return null;
  }
}

export function writeLastBranch(scope: Scope) {
  try {
    if (scope.kind === "branch") localStorage.setItem(PREFERENCE_KEY, scope.branchId);
    else localStorage.removeItem(PREFERENCE_KEY);
  } catch {
    // Preference only.
  }
}
