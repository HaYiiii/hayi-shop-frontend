import { cn, focusRing } from "@hayi/ui";
import { Link } from "@tanstack/react-router";
import type { BranchConflict } from "../branch-form";
import { conflictCopy } from "../branch-status";

const linkClass = cn("shrink-0 rounded-sm text-label text-matcha-700 hover:text-matcha-800", focusRing);

/** Where staff resolve each kind of open commitment; group sessions have no screen yet. */
function ResolveLink({ type, branchId }: { type: BranchConflict["type"]; branchId: string }) {
  if (type === "OPEN_GROUP_SESSIONS") return null;
  return (
    <Link to="/branches/$branchId/orders" params={{ branchId }} className={linkClass}>
      {type === "ACTIVE_ORDERS" ? "Mở Bảng đơn" : "Xem theo ngày"}
    </Link>
  );
}

/** `conflicts[]` of closure-check or `409 BRANCH_HAS_OPEN_COMMITMENTS` (API 09 §1.3). */
export function CommitmentList({ conflicts, branchId }: { conflicts: BranchConflict[]; branchId: string }) {
  return (
    <ul className="grid gap-2">
      {conflicts.map((conflict) => {
        // A commitment type newer than this client still shows its count.
        const copy = conflictCopy[conflict.type] ?? { title: "Việc khác đang mở", detail: conflict.type };
        return (
        <li key={conflict.type} className="flex items-center gap-3 rounded-md border border-line p-3">
          <span className="grid h-9 min-w-9 place-items-center rounded-pill bg-danger-soft px-2 text-body-lg font-semibold text-danger tabular-nums">
            {conflict.count}
          </span>
          <span className="grid min-w-0 flex-1">
            <span className="text-body font-semibold">{copy.title}</span>
            <span className="text-caption text-ink-muted">{copy.detail}</span>
          </span>
          <ResolveLink type={conflict.type} branchId={branchId} />
        </li>
        );
      })}
    </ul>
  );
}
