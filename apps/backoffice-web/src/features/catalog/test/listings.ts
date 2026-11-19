import { json } from "../../../test/fake-api";
import type { BranchListing, BranchListingRow } from "../api/listings";

/** Matcha Latte at the Branch (v3): M with a Branch price 48.000 (base 45.000), L at its base 55.000. */
export function aListing(overrides: Partial<BranchListing> = {}): BranchListing {
  return {
    availabilityState: "AVAILABLE",
    version: 3,
    variants: [
      { variantId: "v-m", name: "M", basePrice: 45000, price: 48000, effectivePrice: 48000, availabilityState: "AVAILABLE" },
      { variantId: "v-l", name: "L", basePrice: 55000, price: null, effectivePrice: 55000, availabilityState: "AVAILABLE" },
    ],
    ...overrides,
  };
}

export function aListingRow(overrides: Partial<BranchListingRow> = {}): BranchListingRow {
  return { productId: "p-latte", productCode: "MATCHA-LATTE", name: "Matcha Latte", status: "ACTIVE", listing: aListing(), ...overrides };
}

/** A listing command's answer with its `ETag`. */
export function listingResponse(row: BranchListingRow) {
  const response = json(row);
  if (row.listing) response.headers.set("ETag", `"v${row.listing.version}"`);
  return response;
}
