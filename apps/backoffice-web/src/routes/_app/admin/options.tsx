import { createFileRoute } from "@tanstack/react-router";
import { OptionLibrary } from "../../../features/catalog/components/option-library";
import { PermissionGuard } from "../../../lib/permission-guard";

interface OptionSearch {
  /** The open group, or `new` for the create form. */
  group?: string;
}

/** Option library (D3d screen 27): brand-level, so the URL carries no Branch (SOURCE-STRUCTURE §3.1). */
export const Route = createFileRoute("/_app/admin/options")({
  validateSearch: (search: Record<string, unknown>): OptionSearch =>
    typeof search.group === "string" && search.group ? { group: search.group } : {},
  component: OptionsRoute,
});

function OptionsRoute() {
  const { group } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <PermissionGuard permission="CATALOG_VIEW">
      <OptionLibrary selected={group} onSelect={(next) => void navigate({ search: next ? { group: next } : {} })} />
    </PermissionGuard>
  );
}
