import { cn, focusRing } from "@hayi/ui";
import { Link } from "@tanstack/react-router";

/** "Chi nhánh / {current}" above a Branch admin screen (D3c). */
export function Breadcrumb({ current }: { current: string }) {
  return (
    <nav aria-label="Vị trí" className="text-label font-normal text-ink-muted">
      <Link
        to="/admin/branches"
        className={cn("rounded-sm text-matcha-700 hover:text-matcha-800", focusRing)}
      >
        Chi nhánh
      </Link>
      <span aria-hidden="true">{" / "}</span>
      <span aria-current="page">{current}</span>
    </nav>
  );
}
