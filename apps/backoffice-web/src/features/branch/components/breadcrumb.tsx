import { cn, focusRing } from "@hayi/ui";
import { Link } from "@tanstack/react-router";

const linkClass = cn("rounded-sm text-matcha-700 hover:text-matcha-800", focusRing);

/** "Chi nhánh / [{branch} /] {current}" above a Branch admin screen (D3c). */
export function Breadcrumb({ branch, current }: { branch?: { id: string; name: string }; current: string }) {
  return (
    <nav aria-label="Vị trí" className="text-label font-normal text-ink-muted">
      <Link to="/admin/branches" className={linkClass}>
        Chi nhánh
      </Link>
      <span aria-hidden="true">{" / "}</span>
      {branch ? (
        <>
          <Link to="/admin/branches/$id" params={{ id: branch.id }} className={linkClass}>
            {branch.name}
          </Link>
          <span aria-hidden="true">{" / "}</span>
        </>
      ) : null}
      <span aria-current="page">{current}</span>
    </nav>
  );
}
