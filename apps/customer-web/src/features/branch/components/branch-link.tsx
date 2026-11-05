"use client";

import Link from "next/link";
import type { ComponentProps } from "react";

/** The chosen Branch is a UI preference, not a credential: a plain cookie the server pages can read (S2). */
export const BRANCH_COOKIE = "hayi.branch";

function rememberBranch(branchCode: string) {
  document.cookie = `${BRANCH_COOKIE}=${encodeURIComponent(branchCode)}; path=/; max-age=31536000; samesite=lax`;
}

/** Link to a Branch's menu that remembers the choice. */
export function BranchLink({ branchCode, ...props }: Omit<ComponentProps<typeof Link>, "href"> & { branchCode: string }) {
  return <Link href={`/b/${encodeURIComponent(branchCode)}/menu`} onClick={() => rememberBranch(branchCode)} {...props} />;
}
