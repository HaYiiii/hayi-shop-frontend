import { cn, focusRing } from "@hayi/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { loadBranches } from "../../../../../features/branch/api/branches";
import { BranchListError } from "../../../../../features/branch/components/branch-list";
import { publicApi } from "../../../../../lib/api";

export const metadata: Metadata = { title: "Menu · HaYi Shop" };

/** Placeholder until the menu slice (S2): confirms the chosen Branch and leads back. */
export default async function MenuPage({ params }: { params: Promise<{ branchCode: string }> }) {
  await connection();
  const [{ branchCode }, result] = await Promise.all([params, loadBranches(publicApi())]);
  if (!result.ok) {
    return (
      <main className="mx-auto grid max-w-content gap-4 px-4 py-6">
        <BranchListError code={result.code} />
      </main>
    );
  }
  // The public API looks Branches up by id; the URL carries the code (SOURCE-STRUCTURE §3.1).
  const branch = result.branches.find((b) => b.branchCode === decodeURIComponent(branchCode));
  if (!branch) notFound();

  return (
    <main className="mx-auto grid max-w-content gap-3 px-4 py-6">
      <h1 className="font-display text-display-lg text-balance">{branch.name}</h1>
      <p className="text-body text-ink-muted">Menu của chi nhánh sẽ có ở bản cập nhật tiếp theo.</p>
      <Link
        href="/"
        className={cn(
          "inline-flex min-h-11 items-center justify-self-start text-body font-medium text-matcha-700 underline-offset-4 hover:underline",
          focusRing,
        )}
      >
        Chọn chi nhánh khác
      </Link>
    </main>
  );
}
