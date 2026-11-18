import { cn, focusRing } from "@hayi/ui";
import { Link } from "@tanstack/react-router";

/** "Món / {current}" above a Product screen (D3d screens 22–23). */
export function ProductBreadcrumb({ current }: { current: string }) {
  return (
    <nav aria-label="Vị trí" className="text-label font-normal text-ink-muted">
      <Link to="/admin/products" className={cn("rounded-sm text-matcha-700 hover:text-matcha-800", focusRing)}>
        Món
      </Link>
      <span aria-hidden="true">{" / "}</span>
      <span aria-current="page">{current}</span>
    </nav>
  );
}
