import type { BranchDirectory } from "../../lib/scope";
import type { Branch } from "./branch-form";
import { statusLabel, statusTone } from "./branch-status";

/** `GET /branches` as the header shows it: a status only for a Branch that is not active (D3b screen 6). */
export function branchDirectory(branches: readonly Branch[]): BranchDirectory {
  return new Map(
    branches.map((b) => [
      b.branchId,
      { name: b.name, status: b.status === "ACTIVE" ? null : { label: statusLabel[b.status], tone: statusTone[b.status] } },
    ]),
  );
}
