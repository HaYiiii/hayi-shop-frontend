import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { loadBranches } from "../../../../../../features/branch/api/branches";
import { BranchListError } from "../../../../../../features/branch/components/branch-list";
import { branchOf } from "../../../../../../features/branch/find-branch";
import { MenuError } from "../../../../../../features/menu/components/menu-error";
import { loadProduct } from "../../../../../../features/product/api/product";
import { ProductDetailView } from "../../../../../../features/product/components/product-detail-view";
import { publicApi } from "../../../../../../lib/api";

export const metadata: Metadata = { title: "Chi tiết món · HaYi Shop" };

/** A malformed `%` escape is no slug: not found rather than a server error. */
function slugOrNull(segment: string): string | null {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}

/** D3a screen 3: one product at the Branch in the URL (Server Component, `/api/public/v1`, cached per X1). */
export default async function ProductPage({ params }: { params: Promise<{ branchCode: string; slug: string }> }) {
  await connection();
  const api = publicApi();
  const [{ branchCode, slug }, result] = await Promise.all([params, loadBranches(api)]);
  const retryHref = `/b/${branchCode}/p/${slug}`;
  const menuHref = `/b/${branchCode}/menu`;
  if (!result.ok) {
    return (
      <main className="mx-auto grid max-w-content gap-4 px-4 py-6">
        <BranchListError code={result.code} retryHref={retryHref} />
      </main>
    );
  }
  const branch = branchOf(result, branchCode);
  const productSlug = slugOrNull(slug);
  if (!branch || productSlug === null) notFound();

  const loaded = await loadProduct(api, branch.branchId, productSlug);
  if (!loaded.ok) {
    // Not on this Branch's menu (AI1), or the Branch closed meanwhile (W6).
    if (loaded.code === "CATALOG_PRODUCT_NOT_FOUND" || loaded.code === "BRANCH_NOT_FOUND") notFound();
    return (
      <main className="mx-auto grid max-w-content gap-4 px-4 py-6">
        <MenuError code={loaded.code} retryHref={retryHref} subject="món" />
      </main>
    );
  }
  return <ProductDetailView product={loaded.product} menuHref={menuHref} />;
}
