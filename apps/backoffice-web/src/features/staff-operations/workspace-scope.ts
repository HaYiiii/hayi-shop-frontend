import type { BackofficeComponents } from "@hayi/api-client";

export type Me = BackofficeComponents["schemas"]["BackofficeMe"];

/** Where the user is working: the whole store (STORE roles) or one assigned Branch (Staff Operations §16.2). */
export type Scope = { kind: "store" } | { kind: "branch"; branchId: string };

/** Stable string for a scope: list keys, select values, equality. */
export function scopeKey(scope: Scope): string {
  return scope.kind === "store" ? "store" : `branch:${scope.branchId}`;
}

/** STORE roles may work store-wide; every user may pick a Branch where a BRANCH role is in force. */
export function scopeOptions(me: Me): Scope[] {
  const branches = me.branches.map((b): Scope => ({ kind: "branch", branchId: b.branchId }));
  return me.storeRoles.length > 0 ? [{ kind: "store" }, ...branches] : branches;
}

/** Permissions in force for the scope: `branches[].permissions` already include STORE ones (Decision M4). */
export function permissionsIn(me: Me, scope: Scope): ReadonlySet<string> {
  if (scope.kind === "store") return new Set(me.storePermissions);
  return new Set(me.branches.find((b) => b.branchId === scope.branchId)?.permissions ?? []);
}

/** The last-used Branch is only a preference: it applies while it is still one of the options. */
export function initialScope(me: Me, preferredBranchId: string | null): Scope | null {
  const options = scopeOptions(me);
  return (
    options.find((s) => s.kind === "branch" && s.branchId === preferredBranchId) ?? options[0] ?? null
  );
}
