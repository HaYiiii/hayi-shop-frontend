import { type ReactNode, createContext, use } from "react";
import type { Me, Scope } from "./scope";

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
