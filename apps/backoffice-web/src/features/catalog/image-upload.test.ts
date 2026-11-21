import { ApiError, StorageUploadError } from "@hayi/api-client";
import { describe, expect, it } from "vitest";
import type { ProductImage } from "./api/images";
import { IMAGE_MAX_BYTES, QuarantinedImageError, checkImageFile, movedImageIds, uploadErrorText } from "./image-upload";

const file = (name: string, type: string, size: number) => new File([new Uint8Array(size)], name, { type });

describe("checkImageFile", () => {
  it("accepts JPEG, PNG and WebP up to 5 MB", () => {
    expect(checkImageFile(file("a.jpg", "image/jpeg", 10))).toEqual({ ok: true, contentType: "image/jpeg" });
    expect(checkImageFile(file("a.webp", "image/webp", IMAGE_MAX_BYTES))).toEqual({ ok: true, contentType: "image/webp" });
  });

  it("rejects other types, empty and too large files with the screen 25 message", () => {
    const message = "Chưa tải được “hero.heic”: chỉ nhận ảnh JPEG, PNG hoặc WebP, tối đa 5 MB. Đổi định dạng hoặc giảm dung lượng rồi tải lại.";
    expect(checkImageFile(file("hero.heic", "image/heic", 10))).toEqual({ ok: false, message });
    expect(checkImageFile(file("big.jpg", "image/jpeg", IMAGE_MAX_BYTES + 1)).ok).toBe(false);
    expect(checkImageFile(file("empty.png", "image/png", 0)).ok).toBe(false);
  });
});

describe("uploadErrorText", () => {
  const problem = (code: string, status = 422) => new ApiError({ status, code });

  it("says what went wrong by code; a cancelled upload says nothing", () => {
    expect(uploadErrorText(new StorageUploadError("aborted"), "a.jpg")).toBeNull();
    expect(uploadErrorText(new StorageUploadError("network"), "a.jpg")).toBe("Chưa tải được “a.jpg” lên kho ảnh. Kiểm tra mạng rồi thử lại.");
    expect(uploadErrorText(problem("UPLOAD_MIME_MISMATCH"), "a.jpg")).toMatch(/chỉ nhận ảnh JPEG, PNG hoặc WebP/);
    expect(uploadErrorText(problem("UPLOAD_CHECKSUM_MISMATCH"), "a.jpg")).toBe("“a.jpg” bị lỗi khi tải lên. Bạn tải lại nhé.");
    expect(uploadErrorText(problem("CATALOG_IMAGE_LIMIT_REACHED", 409), "a.jpg")).toBe("Món đã có đủ 10 ảnh. Xoá bớt ảnh rồi tải thêm.");
    expect(uploadErrorText(new QuarantinedImageError(), "a.jpg")).toBe("Không đọc được “a.jpg” như một ảnh. Chọn ảnh khác.");
  });
});

describe("movedImageIds", () => {
  const image = (imageId: string, sortOrder: number): ProductImage => ({
    imageId,
    storedObjectId: `o-${imageId}`,
    url: null,
    altText: null,
    sortOrder,
    isPrimary: sortOrder === 0,
  });
  const images = [image("b", 1), image("a", 0), image("c", 2)];

  it("moves one image one place within the order customers see", () => {
    expect(movedImageIds(images, "b", -1)).toEqual(["b", "a", "c"]);
    expect(movedImageIds(images, "b", 1)).toEqual(["a", "c", "b"]);
    expect(movedImageIds(images, "a", -1)).toBeNull();
    expect(movedImageIds(images, "c", 1)).toBeNull();
  });
});
