import { createFileRoute } from "@tanstack/react-router";
import { CollectionsScreen } from "../../../features/catalog/components/collections-screen";
import { PermissionGuard } from "../../../lib/permission-guard";

interface CollectionsSearch {
  /** A collection id, or `new`. */
  c?: string;
}

/** D3d screen 28 (brand-level, so no Branch in the URL; SOURCE-STRUCTURE §3.1). */
export const Route = createFileRoute("/_app/admin/collections")({
  validateSearch: (search: Record<string, unknown>): CollectionsSearch =>
    typeof search.c === "string" && search.c ? { c: search.c } : {},
  component: CollectionsRoute,
});

function CollectionsRoute() {
  const { c } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <PermissionGuard permission="CATALOG_VIEW">
      <CollectionsScreen selected={c} onSelect={(next) => void navigate({ search: next ? { c: next } : {}, replace: true })} />
    </PermissionGuard>
  );
}
