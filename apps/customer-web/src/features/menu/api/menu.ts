import { type PublicComponents, type createPublicClient, toProblem } from "@hayi/api-client";

type Schemas = PublicComponents["schemas"];
export type PublicMenu = Schemas["PublicMenu"];
export type MenuCategory = Schemas["MenuCategory"];
export type MenuProduct = Schemas["MenuProduct"];
export type MenuAvailability = Schemas["MenuAvailability"];
type PublicClient = ReturnType<typeof createPublicClient>;

/** The menu, or the Problem `code` to explain (API 02 §4); a failed connection is `NETWORK_ERROR`. */
export type MenuResult = { ok: true; menu: PublicMenu } | { ok: false; code: string };

/** `GET /branches/{branchId}/menu` (API 02 §2.1, Decision AH); the client decides caching (`lib/api.ts`, X1). */
export async function loadMenu(api: PublicClient, branchId: string): Promise<MenuResult> {
  try {
    const { data, error, response } = await api.GET("/branches/{branchId}/menu", { params: { path: { branchId } } });
    if (data) return { ok: true, menu: data };
    return { ok: false, code: toProblem(response.status, error).code };
  } catch {
    return { ok: false, code: "NETWORK_ERROR" };
  }
}
