import type * as ApiClient from "@hayi/api-client";
import { StorageUploadError } from "@hayi/api-client";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { json } from "../../../test/fake-api";
import { owner, renderAdmin } from "../../branch/test/render-admin";
import type { ProductImage } from "../api/images";
import type { Product } from "../api/products";
import { aTree } from "../test/categories";
import { aProduct, productResponse } from "../test/products";

const storage = vi.hoisted(() => ({
  put: vi.fn<(target: unknown, body: Blob, options: { onProgress?: (f: number) => void; signal?: AbortSignal }) => Promise<void>>(),
}));
vi.mock("@hayi/api-client", async (original) => ({
  ...(await original<typeof ApiClient>()),
  putToStorage: storage.put,
}));

const catalogOwner = { ...owner, storePermissions: [...owner.storePermissions, "CATALOG_VIEW", "CATALOG_MANAGE", "CATALOG_PRICE_MANAGE"] };
const catalogViewer = { ...owner, storePermissions: ["BRANCH_VIEW", "CATALOG_VIEW"] };
const PATH = "/admin/products/p-new/images";

const image = (imageId: string, sortOrder: number, isPrimary = false): ProductImage => ({
  imageId,
  storedObjectId: `o-${imageId}`,
  url: `https://cdn.hayi.test/${imageId}.webp`,
  altText: null,
  sortOrder,
  isPrimary,
});

const intent = {
  storedObjectId: "o-new",
  upload: { method: "PUT", url: "https://storage.test/put?sig=1", headers: { "Content-Type": "image/jpeg" }, expiresAt: "2026-11-21T03:10:00Z" },
  constraints: { maxSizeBytes: 5242880, allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"] },
};

function server(initial: Product = aProduct({ images: [image("a", 0, true), image("b", 1)] })) {
  let product = initial;
  const put = (next: Partial<Product>, status = 200) => {
    product = { ...product, ...next, version: product.version + 1 };
    return productResponse(product, status);
  };
  return {
    handlers: {
      "GET /branches": () => json({ items: [] }),
      "GET /categories": () => json(aTree()),
      "GET /products/p-new": () => productResponse(product),
      "POST /uploads": () => json(intent, 201),
      "POST /uploads/o-new/finalize": () =>
        json({ storedObjectId: "o-new", status: "ACTIVE", detectedMimeType: "image/jpeg", sizeBytes: 3, width: 800, height: 600, publicUrl: "https://cdn.hayi.test/new.jpg" }),
      "POST /products/p-new/images": () => put({ images: [...product.images, { ...image("new", product.images.length), storedObjectId: "o-new" }] }, 201),
      "PATCH /products/p-new/images/b": (body: unknown) => {
        const patch = body as { altText?: string | null; isPrimary?: true };
        return put({
          images: product.images.map((i) =>
            i.imageId === "b" ? { ...i, ...patch, isPrimary: patch.isPrimary ?? i.isPrimary } : patch.isPrimary ? { ...i, isPrimary: false } : i,
          ),
        });
      },
      "PUT /products/p-new/images/order": (body: unknown) => {
        const ids = (body as { imageIds: string[] }).imageIds;
        return put({ images: product.images.map((i) => ({ ...i, sortOrder: ids.indexOf(i.imageId) })) });
      },
      "DELETE /products/p-new/images/b": () => put({ images: product.images.filter((i) => i.imageId !== "b") }),
    },
  };
}

function ifMatchOf(api: ReturnType<typeof renderAdmin>["api"], route: string) {
  return api.calls.filter((c) => c.route === route).map((c) => c.headers.get("If-Match"));
}

const jpeg = () => new File(["abc"], "latte.jpg", { type: "image/jpeg" });

beforeEach(() => {
  storage.put.mockReset();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Product images (D3d screen 25)", () => {
  it("is the tab Ảnh with the images in order, the primary marked and a fixed frame with alt", async () => {
    renderAdmin(PATH, server().handlers, catalogOwner);
    expect(await screen.findByRole("link", { name: "Ảnh 2" })).toHaveAttribute("aria-current", "page");
    const first = within(screen.getByRole("article", { name: "Ảnh 1" }));
    expect(first.getByText("Ảnh chính")).toBeInTheDocument();
    expect(first.getByRole("img", { name: "Matcha Đá Xay" })).toHaveAttribute("width", "400");
    expect(within(screen.getByRole("article", { name: "Ảnh 2" })).getByRole("button", { name: "Đặt làm ảnh chính" })).toBeInTheDocument();
  });

  it("uploads a picked image: intent, PUT to storage with progress, finalize, then attaches it", async () => {
    let resolvePut!: () => void;
    storage.put.mockImplementation((_t, _b, options) => {
      options.onProgress?.(0.62);
      return new Promise<void>((resolve) => {
        resolvePut = resolve;
      });
    });
    const { api, user } = renderAdmin(PATH, server().handlers, catalogOwner);
    await user.upload(await screen.findByLabelText(/Kéo ảnh vào đây hoặc chọn từ máy/), jpeg());

    const bar = await screen.findByRole("progressbar", { name: "Đang tải latte.jpg" });
    expect(bar).toHaveAttribute("aria-valuenow", "62");
    expect(api.bodyOf("POST /uploads")).toEqual({
      purpose: "PRODUCT_IMAGE",
      fileName: "latte.jpg",
      contentType: "image/jpeg",
      sizeBytes: 3,
      checksumSha256: "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    });
    expect(storage.put.mock.calls[0]![0]).toEqual(intent.upload);

    resolvePut();
    expect(await screen.findByRole("article", { name: "Ảnh 3" })).toBeInTheDocument();
    expect(api.calls.some((c) => c.route === "POST /uploads/o-new/finalize")).toBe(true);
    expect(api.bodyOf("POST /products/p-new/images")).toEqual({ storedObjectId: "o-new" });
    expect(ifMatchOf(api, "POST /products/p-new/images")).toEqual(['"v0"']);
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("refuses other formats before sending anything", async () => {
    const { api } = renderAdmin(PATH, server().handlers, catalogOwner);
    // A dropped file skips the picker's `accept` filter.
    fireEvent.change(await screen.findByLabelText(/Kéo ảnh vào đây hoặc chọn từ máy/), {
      target: { files: [new File(["x"], "hero.heic", { type: "image/heic" })] },
    });
    expect(screen.getByRole("alert")).toHaveTextContent("Chưa tải được “hero.heic”: chỉ nhận ảnh JPEG, PNG hoặc WebP, tối đa 5 MB.");
    expect(api.calls.some((c) => c.route === "POST /uploads")).toBe(false);
  });

  it("cancels an upload with Huỷ tải: nothing is attached and no error shows", async () => {
    storage.put.mockImplementation(
      (_t, _b, options) =>
        new Promise<void>((_resolve, reject) => {
          options.signal?.addEventListener("abort", () => reject(new StorageUploadError("aborted")));
        }),
    );
    const { api, user } = renderAdmin(PATH, server().handlers, catalogOwner);
    await user.upload(await screen.findByLabelText(/Kéo ảnh vào đây hoặc chọn từ máy/), jpeg());
    await user.click(await screen.findByRole("button", { name: "Huỷ tải" }));
    await waitFor(() => expect(screen.queryByRole("progressbar")).not.toBeInTheDocument());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(api.calls.some((c) => c.route === "POST /products/p-new/images")).toBe(false);
  });

  it("sets the primary, saves the alt text on blur, moves and deletes an image, each with the latest version", async () => {
    const { api, user } = renderAdmin(PATH, server().handlers, catalogOwner);
    const second = within(await screen.findByRole("article", { name: "Ảnh 2" }));

    await user.click(second.getByRole("button", { name: "Đặt làm ảnh chính" }));
    expect(await screen.findByText("Đã đặt làm ảnh chính.")).toBeInTheDocument();
    expect(api.bodyOf("PATCH /products/p-new/images/b")).toEqual({ isPrimary: true });

    await user.type(within(screen.getByRole("article", { name: "Ảnh 2" })).getByRole("textbox", { name: "Mô tả ảnh" }), "Ly pha chế");
    await user.tab();
    expect(await screen.findByText("Đã lưu mô tả ảnh.")).toBeInTheDocument();
    expect(api.bodyOf("PATCH /products/p-new/images/b")).toEqual({ altText: "Ly pha chế" });

    await user.click(screen.getByRole("button", { name: "Chuyển ảnh 2 sang trái" }));
    await waitFor(() => expect(api.bodyOf("PUT /products/p-new/images/order")).toEqual({ imageIds: ["b", "a"] }));

    await user.click(await screen.findByRole("button", { name: "Xoá ảnh 1" }));
    await user.click(within(await screen.findByRole("dialog", { name: "Xoá ảnh này khỏi món?" })).getByRole("button", { name: "Xoá ảnh" }));
    expect(await screen.findByText("Đã xoá ảnh.")).toBeInTheDocument();
    expect(ifMatchOf(api, "PATCH /products/p-new/images/b")).toEqual(['"v0"', '"v1"']);
    expect(ifMatchOf(api, "PUT /products/p-new/images/order")).toEqual(['"v2"']);
    expect(ifMatchOf(api, "DELETE /products/p-new/images/b")).toEqual(['"v3"']);
  });

  it("is read-only without CATALOG_MANAGE", async () => {
    renderAdmin(PATH, server().handlers, catalogViewer);
    await screen.findByRole("article", { name: "Ảnh 1" });
    expect(screen.queryByLabelText(/Kéo ảnh vào đây/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Đặt làm ảnh chính" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("textbox", { name: "Mô tả ảnh" })[0]).toHaveAttribute("readonly");
  });
});
