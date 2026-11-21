import { Button } from "@hayi/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { errorCode, useApi } from "../../../lib/api";
import { FormAlert } from "../../../lib/form-alert";
import { type Category, categoryKeys, updateCategory } from "../api/categories";
import { useImageUpload } from "../hooks/use-image-upload";
import { checkImageFile, uploadErrorText } from "../image-upload";
import { ImageDrop, UploadTile } from "./image-drop";

/**
 * The Category's image (API 08 §1.8: `PATCH /categories/{id}` `imageObjectId`, `null` removes it; the old file
 * is archived). Not in the screen 20 mockup: added in the D2 form pattern with screen 25's upload pieces
 * (agreed 2026-11-21). It saves at once, apart from the form's other fields.
 */
export function CategoryImage({ category }: { category: Category }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const titleId = useId();
  const { uploading, upload, cancel } = useImageUpload("CATEGORY_IMAGE");
  const [message, setMessage] = useState<{ tone: "danger" | "success" | "warning"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(imageObjectId: string | null, done: string) {
    await updateCategory(api, category, { imageObjectId });
    await queryClient.invalidateQueries({ queryKey: categoryKeys.all });
    setMessage({ tone: "success", text: done });
  }

  function failed(error: unknown, fileName?: string) {
    if (errorCode(error) === "VERSION_CONFLICT") {
      setMessage({ tone: "warning", text: "Danh mục vừa được người khác cập nhật. Tải lại rồi thử lại." });
      return;
    }
    const text = fileName ? uploadErrorText(error, fileName) : "Chưa lưu được ảnh danh mục. Bạn thử lại sau ít phút nhé.";
    if (text) setMessage({ tone: "danger", text });
  }

  async function addFile(files: File[]) {
    const file = files[0];
    if (!file) return;
    setMessage(null);
    const checked = checkImageFile(file);
    if (!checked.ok) {
      setMessage({ tone: "danger", text: checked.message });
      return;
    }
    try {
      const stored = await upload(file, checked.contentType);
      await save(stored.storedObjectId, "Đã lưu ảnh danh mục.");
    } catch (error) {
      failed(error, file.name);
    }
  }

  async function remove() {
    setMessage(null);
    setBusy(true);
    try {
      await save(null, "Đã xoá ảnh danh mục.");
    } catch (error) {
      failed(error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby={titleId} className="grid gap-2.5 border-t border-line pt-3.5">
      <h3 id={titleId} className="text-label font-semibold">
        Ảnh danh mục <span className="font-normal text-ink-muted">(không bắt buộc)</span>
      </h3>
      {message ? <FormAlert tone={message.tone}>{message.text}</FormAlert> : null}
      {uploading ? (
        <UploadTile uploading={uploading} onCancel={cancel} />
      ) : category.imageUrl ? (
        <div className="grid gap-2">
          <div className="aspect-[4/3] w-full overflow-hidden rounded-md bg-sunken">
            <img src={category.imageUrl} alt={category.name} width={400} height={300} className="size-full object-cover" />
          </div>
          <div className="flex flex-wrap gap-2">
            <ImageDrop onFiles={(files) => void addFile(files)} label="Đổi ảnh" />
            <Button variant="ghost" density="compact" busy={busy} onClick={() => void remove()}>
              Xoá ảnh
            </Button>
          </div>
        </div>
      ) : (
        <ImageDrop onFiles={(files) => void addFile(files)} />
      )}
      <p className="text-caption text-ink-muted">Ảnh hiện ở đầu danh mục trên menu. Lưu ngay khi tải lên, không cần bấm Lưu thay đổi.</p>
    </section>
  );
}
