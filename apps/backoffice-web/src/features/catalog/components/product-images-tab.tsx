import { Button, Card, Dialog, Field, StatusBadge } from "@hayi/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { errorCode, useApi } from "../../../lib/api";
import { FormAlert } from "../../../lib/form-alert";
import { type ProductImage, addProductImage, deleteProductImage, reorderProductImages, updateProductImage } from "../api/images";
import { type Product, productKeys } from "../api/products";
import { useImageUpload } from "../hooks/use-image-upload";
import { IMAGES_MAX, checkImageFile, inImageOrder, movedImageIds, uploadErrorText } from "../image-upload";
import { ImageDrop, UploadTile } from "./image-drop";
import { useProductPage } from "./product-page";

/**
 * D3d screen 25, tab "Ảnh": upload (pre-signed, with progress and cancel), primary image, alt text, order and
 * delete (API 06 §1, API 08 §1.8, Decision AG). Each command answers the Product with its next version.
 */
export function ProductImagesTab() {
  const api = useApi();
  const queryClient = useQueryClient();
  const { product, canManage, setNotice } = useProductPage();
  const readOnly = !canManage || product.status === "ARCHIVED";
  const { uploading, upload, cancel } = useImageUpload("PRODUCT_IMAGE");
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<ProductImage | null>(null);
  const [busy, setBusy] = useState(false);
  // The newest version in the cache, for the `If-Match` of the next command (several uploads in a row).
  const latest = () => queryClient.getQueryData<Product>(productKeys.detail(product.productId)) ?? product;
  const images = inImageOrder(product.images);

  function accept(next: Product) {
    queryClient.setQueryData(productKeys.detail(next.productId), next);
  }

  /** Commands other than upload: on a stale version the page offers "Tải lại". */
  async function run(command: (current: Product) => Promise<Product>, done?: string) {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      accept(await command(latest()));
      if (done) setNotice({ tone: "success", text: done });
    } catch (e) {
      const code = errorCode(e);
      if (code === "VERSION_CONFLICT" || code === "CATALOG_IMAGE_NOT_FOUND" || code === "CATALOG_IMAGE_ORDER_STALE") {
        setNotice({ tone: "warning", text: "Ảnh của món vừa được người khác thay đổi. Tải lại rồi thử lại.", reload: true });
      } else {
        setNotice({ tone: "danger", text: "Chưa lưu được thay đổi ảnh. Bạn thử lại sau ít phút nhé." });
      }
    } finally {
      setBusy(false);
    }
  }

  async function addFiles(files: File[]) {
    setError(null);
    setNotice(null);
    for (const file of files) {
      const checked = checkImageFile(file);
      if (!checked.ok) {
        setError(checked.message);
        return;
      }
      if (latest().images.length >= IMAGES_MAX) {
        setError(`Món đã có đủ ${IMAGES_MAX} ảnh. Xoá bớt ảnh rồi tải thêm.`);
        return;
      }
      try {
        const stored = await upload(file, checked.contentType);
        accept(await addProductImage(api, latest(), { storedObjectId: stored.storedObjectId }));
      } catch (e) {
        const text = uploadErrorText(e, file.name);
        if (text) setError(text);
        return;
      }
    }
  }

  return (
    <Card className="max-w-[860px] gap-5 p-6">
      <div className="grid gap-1">
        <h2 className="text-title">Ảnh</h2>
        <p className="text-label font-normal text-ink-muted tabular-nums">{`${images.length}/${IMAGES_MAX} ảnh`}</p>
      </div>
      {error ? <FormAlert tone="danger">{error}</FormAlert> : null}

      <ul className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4" aria-label="Ảnh của món">
        {images.map((image, i) => (
          <li key={image.imageId}>
            <ImageCard
              image={image}
              index={i}
              count={images.length}
              productName={product.name}
              readOnly={readOnly}
              busy={busy}
              onPrimary={() => void run((p) => updateProductImage(api, p, image.imageId, { isPrimary: true }), "Đã đặt làm ảnh chính.")}
              onAlt={(altText) => void run((p) => updateProductImage(api, p, image.imageId, { altText }), "Đã lưu mô tả ảnh.")}
              onMove={(by) => {
                const ids = movedImageIds(latest().images, image.imageId, by);
                if (ids) void run((p) => reorderProductImages(api, p, ids));
              }}
              onDelete={() => setDeleting(image)}
            />
          </li>
        ))}
        {uploading ? (
          <li>
            <UploadTile uploading={uploading} onCancel={cancel} />
          </li>
        ) : null}
      </ul>

      {readOnly ? (
        images.length === 0 ? <p className="text-body text-ink-muted">Món chưa có ảnh.</p> : null
      ) : (
        <ImageDrop onFiles={(files) => void addFiles(files)} disabled={uploading !== null || images.length >= IMAGES_MAX} />
      )}
      <p className="text-caption text-ink-muted">
        Ảnh chính hiện trên menu và đầu trang món; các ảnh còn lại theo thứ tự ở đây. Mô tả ảnh giúp người dùng trình đọc màn hình
        và hiện khi ảnh chưa tải được. Ảnh xoá khỏi món được dọn tự động sau.
      </p>

      <Dialog.Root open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        {deleting ? (
          <Dialog.Content className="w-[min(calc(100%-32px),440px)] p-6">
            <Dialog.Title>Xoá ảnh này khỏi món?</Dialog.Title>
            <Dialog.Description className="text-ink">
              {deleting.isPrimary && images.length > 1
                ? "Đây là ảnh chính: ảnh đầu tiên còn lại sẽ thành ảnh chính."
                : "Ảnh không còn hiện cho khách. Muốn dùng lại thì tải lên lần nữa."}
            </Dialog.Description>
            <Dialog.Actions>
              <Dialog.Close asChild>
                <Button variant="ghost">Huỷ</Button>
              </Dialog.Close>
              <Button
                variant="danger"
                busy={busy}
                onClick={() => {
                  const target = deleting;
                  setDeleting(null);
                  void run((p) => deleteProductImage(api, p, target.imageId), "Đã xoá ảnh.");
                }}
              >
                Xoá ảnh
              </Button>
            </Dialog.Actions>
          </Dialog.Content>
        ) : null}
      </Dialog.Root>
    </Card>
  );
}

interface ImageCardProps {
  image: ProductImage;
  index: number;
  count: number;
  productName: string;
  readOnly: boolean;
  busy: boolean;
  onPrimary: () => void;
  onAlt: (altText: string | null) => void;
  onMove: (by: -1 | 1) => void;
  onDelete: () => void;
}

function ImageCard({ image, index, count, productName, readOnly, busy, onPrimary, onAlt, onMove, onDelete }: ImageCardProps) {
  const [alt, setAlt] = useState(image.altText ?? "");
  const [seen, setSeen] = useState(image.altText);
  if (image.altText !== seen) {
    setSeen(image.altText);
    setAlt(image.altText ?? "");
  }
  const n = index + 1;
  return (
    <article aria-label={`Ảnh ${n}`} className="grid content-start gap-2 rounded-lg border border-line bg-paper p-3">
      <div className="aspect-[4/3] w-full overflow-hidden rounded-md bg-sunken">
        {image.url ? (
          <img src={image.url} alt={image.altText || productName} width={400} height={300} loading="lazy" className="size-full object-cover" />
        ) : null}
      </div>
      {image.isPrimary ? (
        <StatusBadge tone="brand" className="justify-self-start">
          Ảnh chính
        </StatusBadge>
      ) : readOnly ? null : (
        <Button variant="outline" density="compact" className="justify-self-start" aria-disabled={busy || undefined} onClick={() => !busy && onPrimary()}>
          Đặt làm ảnh chính
        </Button>
      )}
      <Field.Root className="gap-1">
        <Field.Label>Mô tả ảnh</Field.Label>
        <Field.Input
          autoComplete="off"
          maxLength={200}
          readOnly={readOnly}
          placeholder="Ví dụ: Ly matcha latte đá trên bàn gỗ"
          value={alt}
          onChange={(e) => setAlt(e.currentTarget.value)}
          onBlur={() => {
            const next = alt.trim() || null;
            if (next !== (image.altText ?? null)) onAlt(next);
          }}
        />
      </Field.Root>
      {readOnly ? null : (
        <div className="flex flex-wrap items-center gap-1">
          {index > 0 ? (
            <Button variant="ghost" density="compact" aria-label={`Chuyển ảnh ${n} sang trái`} aria-disabled={busy || undefined} onClick={() => !busy && onMove(-1)}>
              ← Trước
            </Button>
          ) : null}
          {index < count - 1 ? (
            <Button variant="ghost" density="compact" aria-label={`Chuyển ảnh ${n} sang phải`} aria-disabled={busy || undefined} onClick={() => !busy && onMove(1)}>
              Sau →
            </Button>
          ) : null}
          <Button variant="ghost" density="compact" className="ml-auto" aria-label={`Xoá ảnh ${n}`} onClick={onDelete}>
            Xoá
          </Button>
        </div>
      )}
    </article>
  );
}
