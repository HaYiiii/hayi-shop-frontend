import { type createPublicClient, toProblem } from "@hayi/api-client";
import type { ProductDetail } from "../option-selection";

type PublicClient = ReturnType<typeof createPublicClient>;

/** The product, or the Problem `code` to explain (API 02 §4); a failed connection is `NETWORK_ERROR`. */
export type ProductResult = { ok: true; product: ProductDetail } | { ok: false; code: string };

/** `GET /branches/{branchId}/products/{productIdOrSlug}` (API 02 §2.2, Decision AI); caching per `lib/api.ts` (X1). */
export async function loadProduct(api: PublicClient, branchId: string, productIdOrSlug: string): Promise<ProductResult> {
  try {
    const { data, error, response } = await api.GET("/branches/{branchId}/products/{productIdOrSlug}", {
      params: { path: { branchId, productIdOrSlug } },
    });
    if (data) return { ok: true, product: data };
    return { ok: false, code: toProblem(response.status, error).code };
  } catch {
    return { ok: false, code: "NETWORK_ERROR" };
  }
}
