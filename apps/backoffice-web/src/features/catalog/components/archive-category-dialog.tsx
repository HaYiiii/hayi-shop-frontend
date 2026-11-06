import { Button, Dialog } from "@hayi/ui";
import { errorCode } from "../../../lib/api";
import { FormAlert } from "../../../lib/form-alert";
import type { Category } from "../api/categories";
import type { useArchiveCategory } from "../hooks/use-categories";

interface ArchiveCategoryDialogProps {
  category: Category;
  archive: ReturnType<typeof useArchiveCategory>;
  onConfirm: () => void;
  onReload: () => void;
}

/**
 * Confirm "Lưu trữ…" (dialog pattern of D3c screens 18/19). `CATALOG_CATEGORY_IN_USE` is not shown here:
 * the screen closes the dialog and shows it above the tree, as D3d screen 20 draws it.
 * Render inside `<Dialog.Root>`.
 */
export function ArchiveCategoryDialog({ category, archive, onConfirm, onReload }: ArchiveCategoryDialogProps) {
  const code = errorCode(archive.error);
  const stale = code === "VERSION_CONFLICT" || code === "CATALOG_CATEGORY_ARCHIVED" || code === "CATALOG_CATEGORY_NOT_FOUND";

  return (
    <Dialog.Content className="max-h-[calc(100dvh-32px)] w-[min(calc(100%-32px),440px)] overflow-y-auto overscroll-contain p-6">
      <div className="grid gap-1">
        <Dialog.Title>{`Lưu trữ “${category.name}”?`}</Dialog.Title>
        <Dialog.Description>
          Danh mục đã lưu trữ không hiện trên menu, không chọn làm danh mục chính được và không khôi phục lại được.
        </Dialog.Description>
      </div>
      {stale ? (
        <FormAlert tone="warning">
          {code === "VERSION_CONFLICT"
            ? "Danh mục vừa được người khác cập nhật. Tải lại để xem bản mới rồi thử lại."
            : "Danh mục này đã được lưu trữ hoặc không còn. Tải lại để xem cây mới nhất."}
        </FormAlert>
      ) : archive.isError && code !== "CATALOG_CATEGORY_IN_USE" ? (
        <FormAlert tone="danger">Chưa lưu trữ được. Bạn thử lại sau ít phút nhé.</FormAlert>
      ) : null}
      <Dialog.Actions>
        <Dialog.Close asChild>
          <Button variant="ghost">Hủy</Button>
        </Dialog.Close>
        {stale ? (
          <Button onClick={onReload}>Tải lại</Button>
        ) : (
          <Button variant="danger" busy={archive.isPending} onClick={onConfirm}>
            Lưu trữ danh mục
          </Button>
        )}
      </Dialog.Actions>
    </Dialog.Content>
  );
}
