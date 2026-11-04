import { type PublicComponents, type createPublicClient, toProblem } from "@hayi/api-client";

export type PublicBranch = PublicComponents["schemas"]["PublicBranch"];
type PublicClient = ReturnType<typeof createPublicClient>;

/** The list, or the Problem `code` to explain (API 02 §4); a failed connection is `NETWORK_ERROR`. */
export type BranchesResult = { ok: true; branches: PublicBranch[] } | { ok: false; code: string };

/** `GET /branches`: ACTIVE Branches by `branchCode` (API 02 §1.1); never cached here, `openNow` changes by the minute. */
export async function loadBranches(api: PublicClient): Promise<BranchesResult> {
  try {
    const { data, error, response } = await api.GET("/branches", { cache: "no-store" });
    if (data) return { ok: true, branches: data.items };
    return { ok: false, code: toProblem(response.status, error).code };
  } catch {
    return { ok: false, code: "NETWORK_ERROR" };
  }
}
