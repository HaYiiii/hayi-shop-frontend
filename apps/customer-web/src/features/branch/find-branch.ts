import type { BranchesResult, PublicBranch } from "./api/branches";

/** A malformed `%` escape is no Branch code: not found rather than a server error. */
function decodedOrNull(segment: string): string | null {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}

/**
 * The Branch of a `/b/{branchCode}/…` URL. The public API looks Branches up by id; the URL carries the code
 * (SOURCE-STRUCTURE §3.1), so the code is found in the (cached) list. `undefined` = not found.
 */
export function branchOf(result: Extract<BranchesResult, { ok: true }>, segment: string): PublicBranch | undefined {
  const code = decodedOrNull(segment);
  return code === null ? undefined : result.branches.find((b) => b.branchCode === code);
}
