import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { loadBranches } from "../../../../../features/branch/api/branches";
import { BranchListError } from "../../../../../features/branch/components/branch-list";
import { branchOf } from "../../../../../features/branch/find-branch";
import { loadMenu } from "../../../../../features/menu/api/menu";
import { BranchMenu } from "../../../../../features/menu/components/branch-menu";
import { MenuError } from "../../../../../features/menu/components/menu-error";
import { publicApi } from "../../../../../lib/api";

export const metadata: Metadata = { title: "Menu · HaYi Shop" };

/** D3a screen 2: the menu of the Branch in the URL (Server Component, `/api/public/v1`, cached per X1). */
export default async function MenuPage({ params }: { params: Promise<{ branchCode: string }> }) {
  await connection();
  const api = publicApi();
  const [{ branchCode }, result] = await Promise.all([params, loadBranches(api)]);
  const retryHref = `/b/${branchCode}/menu`;
  if (!result.ok) {
    return (
      <main className="mx-auto grid max-w-content gap-4 px-4 py-6">
        <BranchListError code={result.code} retryHref={retryHref} />
      </main>
    );
  }
  const branch = branchOf(result, branchCode);
  if (!branch) notFound();

  const menu = await loadMenu(api, branch.branchId);
  if (!menu.ok) {
    // Closed or deactivated since the Branch list was cached (W6): the Branch is gone for customers.
    if (menu.code === "BRANCH_NOT_FOUND") notFound();
    return (
      <main className="mx-auto grid max-w-content gap-4 px-4 py-6">
        <MenuError code={menu.code} retryHref={retryHref} />
      </main>
    );
  }
  return <BranchMenu branch={branch} menu={menu.menu} />;
}
