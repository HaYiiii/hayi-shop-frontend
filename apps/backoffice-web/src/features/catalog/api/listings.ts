import type { BackofficeComponents } from "@hayi/api-client";
import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import { type BackofficeClient, unwrap } from "../../../lib/api";

type Schemas = BackofficeComponents["schemas"];
export type BranchListingRow = Schemas["BranchListingRow"];
export type BranchListing = Schemas["BranchListing"];
export type BranchVariantListing = Schemas["BranchVariantListing"];
export type ListingState = Schemas["AvailabilityState"];
export type ListingInput = Schemas["ListingAvailabilityInput"];

export const LISTING_PAGE_SIZE = 20;

export interface ListingFilters {
  q?: string | undefined;
  /** 0-based like the API. */
  page?: number | undefined;
}

export const listingKeys = {
  all: (branchId: string) => ["listings", branchId] as const,
  list: (branchId: string, filters: ListingFilters) => [...listingKeys.all(branchId), filters] as const,
};

/** Every Product not archived, by name, with its listing at the Branch or `null` (API 08 §2.2, AD6). */
export function listingsQuery(api: BackofficeClient, branchId: string, filters: ListingFilters) {
  const { q, page } = filters;
  return queryOptions({
    queryKey: listingKeys.list(branchId, filters),
    queryFn: () =>
      unwrap(
        api.GET("/branches/{branchId}/listings", {
          params: { path: { branchId }, query: { size: LISTING_PAGE_SIZE, ...(page && { page }), ...(q && { q }) } },
        }),
      ),
    placeholderData: keepPreviousData,
  });
}

export type OptionItemListing = Schemas["BranchOptionItemListing"];

export const optionItemListingKeys = {
  all: (branchId: string) => ["option-item-listings", branchId] as const,
};

/** Branch extra prices of the option items that have a listing here (API 08 §2.2, Decision AM). */
export function optionItemListingsQuery(api: BackofficeClient, branchId: string) {
  return queryOptions({
    queryKey: optionItemListingKeys.all(branchId),
    queryFn: () =>
      unwrap(api.GET("/branches/{branchId}/option-item-listings", { params: { path: { branchId } } })).then((list) => list.items),
  });
}

/** Branch extra price of one item (full, `null` = Product / library price, AD4); `"v0"` creates it (AD3). */
export function putOptionItemListing(api: BackofficeClient, branchId: string, optionItemId: string, version: number, extraPrice: number | null) {
  return unwrap(
    api.PUT("/branches/{branchId}/option-item-listings/{optionItemId}", {
      params: { path: { branchId, optionItemId }, header: ifMatch(version) },
      body: { extraPrice },
    }),
  );
}

/** `"v0"` creates the listing (AD2). */
const ifMatch = (version: number) => ({ "If-Match": `"v${version}"` });

/** Sells (`AVAILABLE`) or stops selling (`NOT_AVAILABLE`) a Product at the Branch; `If-Match` required. */
export function putListing(api: BackofficeClient, branchId: string, productId: string, version: number, availabilityState: ListingInput) {
  return unwrap(
    api.PUT("/branches/{branchId}/listings/{productId}", {
      params: { path: { branchId, productId }, header: ifMatch(version) },
      body: { availabilityState },
    }),
  );
}

/** Branch price (full price, `null` = base) and selling state of one size; `If-Match` of the listing. */
export function putVariantListing(
  api: BackofficeClient,
  branchId: string,
  productId: string,
  variantId: string,
  version: number,
  body: Schemas["BranchVariantListingInput"],
) {
  return unwrap(
    api.PUT("/branches/{branchId}/listings/{productId}/variants/{variantId}", {
      params: { path: { branchId, productId, variantId }, header: ifMatch(version) },
      body,
    }),
  );
}
