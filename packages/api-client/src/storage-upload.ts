/**
 * Browser → object storage step of the pre-signed upload (API 06 §1, Decision G8): the only HTTP the apps send
 * outside the generated clients, kept here so `@hayi/api-client` stays the one place that talks HTTP.
 */

/** The `upload` part of `POST /uploads`: send exactly this method, URL and headers. */
export interface StorageUploadTarget {
  method: string;
  url: string;
  headers: Record<string, string>;
}

export interface PutToStorageOptions {
  /** 0..1 as the bytes go out (XMLHttpRequest upload progress; fetch has none). */
  onProgress?: (fraction: number) => void;
  /** Aborting cancels the request ("Huỷ tải"). */
  signal?: AbortSignal;
  /** For tests. */
  createRequest?: () => XMLHttpRequest;
}

export type StorageUploadFailure = "aborted" | "network" | "http";

/** The storage PUT did not complete. `status` is the storage's HTTP status for `http`. */
export class StorageUploadError extends Error {
  readonly kind: StorageUploadFailure;
  readonly status: number | undefined;

  constructor(kind: StorageUploadFailure, status?: number) {
    super(kind === "http" ? `Storage refused the upload (${status})` : `Storage upload ${kind}`);
    this.name = "StorageUploadError";
    this.kind = kind;
    this.status = status;
  }
}

/** PUTs `body` to the pre-signed URL; resolves on a 2xx answer. */
export function putToStorage(target: StorageUploadTarget, body: Blob, options: PutToStorageOptions = {}): Promise<void> {
  const { onProgress, signal, createRequest = () => new XMLHttpRequest() } = options;
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new StorageUploadError("aborted"));
      return;
    }
    const request = createRequest();
    request.open(target.method, target.url);
    for (const [name, value] of Object.entries(target.headers)) request.setRequestHeader(name, value);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) onProgress?.(event.loaded / event.total);
    };
    const onAbort = () => request.abort();
    signal?.addEventListener("abort", onAbort, { once: true });
    const settle = (error?: StorageUploadError) => {
      signal?.removeEventListener("abort", onAbort);
      if (error) reject(error);
      else resolve();
    };
    request.onload = () => settle(request.status >= 200 && request.status < 300 ? undefined : new StorageUploadError("http", request.status));
    request.onerror = () => settle(new StorageUploadError("network"));
    request.onabort = () => settle(new StorageUploadError("aborted"));
    request.send(body);
  });
}

/** Lowercase hex SHA-256 of the bytes, for `checksumSha256` of `POST /uploads`. */
export async function sha256Hex(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
