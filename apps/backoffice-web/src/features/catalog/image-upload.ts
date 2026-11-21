import { ApiError, StorageUploadError } from "@hayi/api-client";
import type { ImageMimeType, ProductImage } from "./api/images";

/** Policy of `PRODUCT_IMAGE` / `CATEGORY_IMAGE` (API 06 §1): checked before anything is sent. */
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const IMAGE_TYPES: readonly ImageMimeType[] = ["image/jpeg", "image/png", "image/webp"];
export const IMAGES_MAX = 10;

const rejected = (fileName: string) =>
  `Chưa tải được “${fileName}”: chỉ nhận ảnh JPEG, PNG hoặc WebP, tối đa 5 MB. Đổi định dạng hoặc giảm dung lượng rồi tải lại.`;

/** The file's MIME type if it may be uploaded, else the message to show (D3d screen 25). */
export function checkImageFile(file: File): { ok: true; contentType: ImageMimeType } | { ok: false; message: string } {
  const contentType = IMAGE_TYPES.find((t) => t === file.type);
  if (!contentType || file.size === 0 || file.size > IMAGE_MAX_BYTES) return { ok: false, message: rejected(file.name) };
  return { ok: true, contentType };
}

/** Thrown when finalize answers `QUARANTINED`: the file is stored but cannot be used as an image. */
export class QuarantinedImageError extends Error {
  constructor() {
    super("Uploaded image quarantined");
    this.name = "QuarantinedImageError";
  }
}

/** Why an upload or attach failed, by Problem `code` (API 06 §1, API 08 §1.8); `null` when it was cancelled. */
export function uploadErrorText(error: unknown, fileName: string): string | null {
  if (error instanceof StorageUploadError) {
    if (error.kind === "aborted") return null;
    return `Chưa tải được “${fileName}” lên kho ảnh. Kiểm tra mạng rồi thử lại.`;
  }
  if (error instanceof QuarantinedImageError) return `Không đọc được “${fileName}” như một ảnh. Chọn ảnh khác.`;
  if (!(error instanceof ApiError)) return `Chưa tải được “${fileName}”. Bạn thử lại sau ít phút nhé.`;
  switch (error.code) {
    case "UPLOAD_TOO_LARGE":
    case "UPLOAD_MIME_MISMATCH":
    case "VALIDATION_FAILED":
      return rejected(fileName);
    case "UPLOAD_CHECKSUM_MISMATCH":
    case "UPLOAD_NOT_FOUND_IN_STORAGE":
      return `“${fileName}” bị lỗi khi tải lên. Bạn tải lại nhé.`;
    case "CATALOG_IMAGE_LIMIT_REACHED":
      return `Món đã có đủ ${IMAGES_MAX} ảnh. Xoá bớt ảnh rồi tải thêm.`;
    case "VERSION_CONFLICT":
      return "Món vừa được người khác cập nhật. Tải lại rồi thử lại.";
    default:
      return `Chưa tải được “${fileName}”. Bạn thử lại sau ít phút nhé.`;
  }
}

/** Images in the order customers see them. */
export const inImageOrder = (images: readonly ProductImage[]) => [...images].sort((a, b) => a.sortOrder - b.sortOrder);

/** The ids with one image moved one place left (`-1`) or right (`1`); `null` when it cannot move. */
export function movedImageIds(images: readonly ProductImage[], imageId: string, by: -1 | 1): string[] | null {
  const ids = inImageOrder(images).map((i) => i.imageId);
  const from = ids.indexOf(imageId);
  const to = from + by;
  if (from < 0 || to < 0 || to >= ids.length) return null;
  [ids[from], ids[to]] = [ids[to]!, ids[from]!];
  return ids;
}
