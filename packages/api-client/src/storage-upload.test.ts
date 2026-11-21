import { describe, expect, it } from "vitest";
import { StorageUploadError, putToStorage, sha256Hex } from "./storage-upload.js";

/** A minimal XMLHttpRequest double: records the request and lets the test drive progress and the outcome. */
class FakeXhr {
  static last: FakeXhr;
  method = "";
  url = "";
  headers: Record<string, string> = {};
  body: unknown;
  status = 0;
  aborted = false;
  upload: { onprogress: ((e: { lengthComputable: boolean; loaded: number; total: number }) => void) | null } = { onprogress: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  constructor() {
    FakeXhr.last = this;
  }
  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }
  setRequestHeader(name: string, value: string) {
    this.headers[name] = value;
  }
  send(body: unknown) {
    this.body = body;
  }
  abort() {
    this.aborted = true;
    this.onabort?.();
  }
  progress(loaded: number, total: number) {
    this.upload.onprogress?.({ lengthComputable: true, loaded, total });
  }
  finish(status: number) {
    this.status = status;
    this.onload?.();
  }
}

const target = { method: "PUT", url: "https://storage.test/hayi-public/product/x.jpg?sig=1", headers: { "Content-Type": "image/jpeg" } };
const createRequest = () => new FakeXhr() as unknown as XMLHttpRequest;

describe("putToStorage", () => {
  it("PUTs the bytes to the pre-signed URL with exactly the given headers and reports progress", async () => {
    const file = new Blob(["abc"], { type: "image/jpeg" });
    const progress: number[] = [];
    const done = putToStorage(target, file, { createRequest, onProgress: (f) => progress.push(f) });
    const xhr = FakeXhr.last;
    expect([xhr.method, xhr.url, xhr.headers, xhr.body]).toEqual([target.method, target.url, { "Content-Type": "image/jpeg" }, file]);
    xhr.progress(1, 4);
    xhr.progress(4, 4);
    xhr.finish(200);
    await done;
    expect(progress).toEqual([0.25, 1]);
  });

  it("rejects with the storage status when the PUT is refused", async () => {
    const done = putToStorage(target, new Blob(["x"]), { createRequest });
    FakeXhr.last.finish(403);
    await expect(done).rejects.toMatchObject({ name: "StorageUploadError", kind: "http", status: 403 });
  });

  it("rejects as network when the connection fails", async () => {
    const done = putToStorage(target, new Blob(["x"]), { createRequest });
    FakeXhr.last.onerror?.();
    await expect(done).rejects.toBeInstanceOf(StorageUploadError);
    await expect(done).rejects.toMatchObject({ kind: "network" });
  });

  it("aborts the request when the signal is aborted", async () => {
    const controller = new AbortController();
    const done = putToStorage(target, new Blob(["x"]), { createRequest, signal: controller.signal });
    controller.abort();
    expect(FakeXhr.last.aborted).toBe(true);
    await expect(done).rejects.toMatchObject({ kind: "aborted" });
  });

  it("does not start when the signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(putToStorage(target, new Blob(["x"]), { createRequest, signal: controller.signal })).rejects.toMatchObject({
      kind: "aborted",
    });
  });
});

describe("sha256Hex", () => {
  it("is the lowercase hex SHA-256 of the bytes", async () => {
    expect(await sha256Hex(new Blob(["abc"]))).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});
