import type { BackofficeComponents } from "@hayi/api-client";
import type { StatusBadgeTone } from "@hayi/ui";

export type Me = BackofficeComponents["schemas"]["BackofficeMe"];

/** Where the user is working: the whole store (STORE roles) or one Branch (Staff Operations §16.2). */
export type Scope = { kind: "store" } | { kind: "branch"; branchId: string };

/** Stable string for a scope: list keys, select values, equality. */
export function scopeKey(scope: Scope): string {
  return scope.kind === "store" ? "store" : `branch:${scope.branchId}`;
}

/** How the header shows a Branch: its name, and its status when it is not active (D3b screen 6). */
export interface BranchLabel {
  name: string;
  status: { label: string; tone: StatusBadgeTone } | null;
}

/** Branches of `GET /branches` (API 09 §1.1) by id; the signed-in layout loads it. */
export type BranchDirectory = ReadonlyMap<string, BranchLabel>;

/** The directory, or why there is none yet: names are never guessed. */
export type BranchNames = BranchDirectory | "loading" | "failed";

export function scopeLabel(scope: Scope, branches: BranchNames): string {
  if (scope.kind === "store") return "Toàn hệ thống";
  if (branches === "loading") return "Đang tải…";
  if (branches === "failed") return "Chưa tải được tên chi nhánh";
  // Only an id the user typed into the URL is missing from the list: it has no permission there either.
  return branches.get(scope.branchId)?.name ?? "Chi nhánh không xác định";
}

/** STORE roles may work store-wide; every user may pick a Branch where a BRANCH role is in force (Decision M4). */
export function scopeOptions(me: Me): Scope[] {
  const branches = me.branches.map((b): Scope => ({ kind: "branch", branchId: b.branchId }));
  return me.storeRoles.length > 0 ? [{ kind: "store" }, ...branches] : branches;
}

/**
 * Permissions in force for the scope (Decision M4): `branches[].permissions` already include the STORE
 * ones, and STORE permissions apply at every Branch, listed or not.
 */
export function permissionsIn(me: Me, scope: Scope): ReadonlySet<string> {
  if (scope.kind === "store") return new Set(me.storePermissions);
  return new Set(me.branches.find((b) => b.branchId === scope.branchId)?.permissions ?? me.storePermissions);
}

/** The last-used Branch is only a preference: it applies while it is still one of the options. */
export function initialScope(me: Me, preferredBranchId: string | null): Scope | null {
  const options = scopeOptions(me);
  return (
    options.find((s) => s.kind === "branch" && s.branchId === preferredBranchId) ?? options[0] ?? null
  );
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
