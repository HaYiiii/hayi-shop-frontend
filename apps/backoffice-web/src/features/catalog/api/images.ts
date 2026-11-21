import type { BackofficeComponents } from "@hayi/api-client";
import { type BackofficeClient, unwrap } from "../../../lib/api";
import type { Product } from "./products";

type Schemas = BackofficeComponents["schemas"];
export type UploadPurpose = Schemas["UploadPurpose"];
export type ImageMimeType = Schemas["ImageMimeType"];
export type UploadIntent = Schemas["UploadIntent"];
export type UploadFinalized = Schemas["UploadFinalized"];
export type ProductImage = Schemas["ProductImage"];

/** Step 1 of the pre-signed upload (API 06 §1, Decision AF): an intent with the URL to PUT to. */
export function createUpload(api: BackofficeClient, body: Schemas["UploadIntentRequest"]) {
  return unwrap(api.POST("/uploads", { body }));
}

/** Step 3: the server checks the stored bytes (size, real MIME, SHA-256, dimensions). */
export function finalizeUpload(api: BackofficeClient, storedObjectId: string) {
  return unwrap(api.POST("/uploads/{storedObjectId}/finalize", { params: { path: { storedObjectId } } }));
}

const ifMatch = (product: Product) => ({ "If-Match": `"v${product.version}"` });
const mergePatch = { "Content-Type": "application/merge-patch+json" };

/** Step 4 for a Product: attaches the finalized object (API 08 §1.8, Decision AG); the first image is primary. */
export function addProductImage(api: BackofficeClient, product: Product, body: Schemas["ProductImageInput"]) {
  return unwrap(
    api.POST("/products/{productId}/images", { params: { path: { productId: product.productId }, header: ifMatch(product) }, body }),
  );
}

/** Alt text, or `isPrimary: true`; `If-Match` required. */
export function updateProductImage(api: BackofficeClient, product: Product, imageId: string, body: Schemas["ProductImagePatch"]) {
  return unwrap(
    api.PATCH("/products/{productId}/images/{imageId}", {
      params: { path: { productId: product.productId, imageId }, header: ifMatch(product) },
      body,
      headers: mergePatch,
    }),
  );
}

/** Detaches the image (the file is archived and purged later); a removed primary passes to the first left. */
export function deleteProductImage(api: BackofficeClient, product: Product, imageId: string) {
  return unwrap(
    api.DELETE("/products/{productId}/images/{imageId}", {
      params: { path: { productId: product.productId, imageId }, header: ifMatch(product) },
    }),
  );
}

/** The full order of the current images; `If-Match` required. */
export function reorderProductImages(api: BackofficeClient, product: Product, imageIds: string[]) {
  return unwrap(
    api.PUT("/products/{productId}/images/order", {
      params: { path: { productId: product.productId }, header: ifMatch(product) },
      body: { imageIds },
    }),
  );
}
