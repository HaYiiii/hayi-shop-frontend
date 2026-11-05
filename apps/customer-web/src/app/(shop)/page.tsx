import type { Metadata } from "next";
import Image from "next/image";
import { connection } from "next/server";
import { loadBranches } from "../../features/branch/api/branches";
import { BranchList, BranchListError } from "../../features/branch/components/branch-list";
import { publicApi } from "../../lib/api";

export const metadata: Metadata = { title: "Chọn chi nhánh · HaYi Shop" };

/** D3a screen 1: choose a Branch (Branch §4.3, API 02 §1). */
export default async function ChooseBranchPage() {
  // Rendered per request ("today" in the pickup line is the visitor's day, and no API call at build time);
  // the API answer itself is cached for a minute (PUBLIC_REVALIDATE_SECONDS, Decision X1).
  await connection();
  const result = await loadBranches(publicApi());

  return (
    <div className="mx-auto grid max-w-content gap-2 px-4 pt-3 pb-6">
      <header className="flex items-center">
        <Image src="/logo.webp" width={56} height={56} alt="HaYi Shop" priority />
      </header>
      <main className="grid gap-4">
        <div className="grid gap-1.5">
          <h1 className="font-display text-display-lg text-balance">Bạn lấy nước ở đâu?</h1>
          <p className="text-body text-ink-muted">Đặt trước, chọn giờ lấy, đến quầy là có ngay.</p>
        </div>
        {result.ok ? <BranchList branches={result.branches} /> : <BranchListError code={result.code} />}
      </main>
    </div>
  );
}
