import { putToStorage, sha256Hex } from "@hayi/api-client";
import { useRef, useState } from "react";
import { useApi } from "../../../lib/api";
import { type ImageMimeType, type UploadFinalized, type UploadPurpose, createUpload, finalizeUpload } from "../api/images";
import { QuarantinedImageError } from "../image-upload";

export interface UploadProgress {
  fileName: string;
  /** 0..1 of the bytes sent to storage. */
  progress: number;
}

/**
 * The pre-signed upload of one image (API 06 §1, Decision G8): intent → PUT to storage (progress, cancel) →
 * finalize. Resolves with the finalized object; the caller attaches it (Product image, Category image).
 */
export function useImageUpload(purpose: UploadPurpose) {
  const api = useApi();
  const [uploading, setUploading] = useState<UploadProgress | null>(null);
  const controller = useRef<AbortController | null>(null);

  async function upload(file: File, contentType: ImageMimeType): Promise<UploadFinalized> {
    const abort = new AbortController();
    controller.current = abort;
    setUploading({ fileName: file.name, progress: 0 });
    try {
      const checksumSha256 = await sha256Hex(file);
      const intent = await createUpload(api, { purpose, fileName: file.name, contentType, sizeBytes: file.size, checksumSha256 });
      await putToStorage(intent.upload, file, {
        signal: abort.signal,
        onProgress: (progress) => setUploading({ fileName: file.name, progress }),
      });
      const finalized = await finalizeUpload(api, intent.storedObjectId);
      if (finalized.status !== "ACTIVE") throw new QuarantinedImageError();
      return finalized;
    } finally {
      controller.current = null;
      setUploading(null);
    }
  }

  /** "Huỷ tải": stops the PUT; `upload` then rejects as aborted. */
  const cancel = () => controller.current?.abort();

  return { uploading, upload, cancel };
}
