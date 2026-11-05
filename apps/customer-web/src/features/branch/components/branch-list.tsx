import { StatusBadge, cn, focusRing } from "@hayi/ui";
import Link from "next/link";
import type { PublicBranch } from "../api/branches";
import { pickupText } from "../pickup-text";
import { BranchLink } from "./branch-link";

function addressText({ address }: PublicBranch) {
  return [address.line, address.ward, address.district].filter(Boolean).join(", ");
}

/** One Branch as a card (D3a screen 1): `ACTIVE` is not open now, so the badge follows `openNow` (Branch §4.3). */
function BranchCard({ branch, now }: { branch: PublicBranch; now: Date }) {
  const pickup = pickupText(branch.earliestPickupAt, now);
  return (
    <BranchLink
      branchCode={branch.branchCode}
      className={cn(
        "grid gap-1.5 rounded-lg border p-4 text-ink no-underline transition-colors hover:border-ink-muted",
        branch.openNow ? "border-line bg-paper" : "border-transparent bg-sunken",
        focusRing,
      )}
    >
      <span className="flex items-center gap-2">
        <span className="min-w-0 text-body-lg font-semibold break-words">{branch.name}</span>
        <StatusBadge tone={branch.openNow ? "success" : "warning"} dot className="ml-auto shrink-0">
          {branch.openNow ? "Đang mở" : "Tạm đóng"}
        </StatusBadge>
      </span>
      <span className="text-label font-normal break-words text-ink-muted">{addressText(branch)}</span>
      <span className={cn("text-label tabular-nums", pickup.today ? "font-medium" : "font-medium text-ink-muted")}>
        {pickup.text}
      </span>
    </BranchLink>
  );
}

/** ACTIVE Branches in the API's order (by `branchCode`). */
export function BranchList({ branches, now = new Date() }: { branches: PublicBranch[]; now?: Date }) {
  if (branches.length === 0) {
    return <p className="text-body text-ink-muted">Hiện chưa có chi nhánh nào nhận đặt trước. Bạn quay lại sau nhé.</p>;
  }
  return (
    <ul aria-label="Chi nhánh" className="grid gap-3">
      {branches.map((branch) => (
        <li key={branch.branchId}>
          <BranchCard branch={branch} now={now} />
        </li>
      ))}
    </ul>
  );
}

/** The list could not be loaded: what to do, by Problem `code` (API 02 §4); "Thử lại" reloads `retryHref`. */
export function BranchListError({ code, retryHref = "/" }: { code: string; retryHref?: string }) {
  const text =
    code === "RATE_LIMITED"
      ? "Bạn tải lại hơi nhanh. Chờ một chút rồi thử lại."
      : "Chưa tải được danh sách chi nhánh. Kiểm tra mạng rồi thử lại.";
  return (
    <div className="grid justify-items-start gap-3">
      <p role="alert" className="rounded-md bg-danger-soft px-3 py-2.5 text-body text-danger">
        {text}
      </p>
      <Link
        href={retryHref}
        className={cn("inline-flex min-h-11 items-center text-body font-medium text-matcha-700 underline-offset-4 hover:underline", focusRing)}
      >
        Thử lại
      </Link>
    </div>
  );
}
