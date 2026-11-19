import { createFileRoute } from "@tanstack/react-router";
import type { ListingFilters } from "../../../../features/catalog/api/listings";
import { BranchListings } from "../../../../features/catalog/components/branch-listings";

/** D3d screen 29: the Branch is in the URL and follows the switcher (SOURCE-STRUCTURE §3.1, API 08 §2). */
export const Route = createFileRoute("/_app/branches/$branchId/listings")({
  validateSearch: (search: Record<string, unknown>): ListingFilters => {
    const q = typeof search.q === "string" && search.q.trim() ? search.q.trim().slice(0, 100) : undefined;
    const page = Number(search.page);
    return { ...(q && { q }), ...(Number.isInteger(page) && page > 0 && { page }) };
  },
  component: ListingsRoute,
});

function ListingsRoute() {
  const { branchId } = Route.useParams();
  const filters = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <BranchListings
      // Another Branch from the switcher starts with nothing expanded and no message.
      key={branchId}
      branchId={branchId}
      filters={filters}
      onFiltersChange={(next) =>
        void navigate({
          search: Object.fromEntries(Object.entries(next).filter(([, v]) => v !== undefined)) as ListingFilters,
          replace: true,
        })
      }
    />
  );
}
