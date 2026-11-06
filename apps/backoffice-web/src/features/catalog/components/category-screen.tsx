import { Button, Card, Dialog, Skeleton } from "@hayi/ui";
import { useEffect, useRef, useState } from "react";
import { errorCode } from "../../../lib/api";
import { FormAlert } from "../../../lib/form-alert";
import { useWorkspace } from "../../../lib/workspace";
import type { Category, CategoryNode } from "../api/categories";
import { activeTree, countArchived, findCategory, isActive, moveRequest } from "../category-form";
import { useArchiveCategory, useCategoryTree, useReorderCategories } from "../hooks/use-categories";
import { ArchiveCategoryDialog } from "./archive-category-dialog";
import { CategoryForm } from "./category-form";
import { CategoryTree, type MoveDirection } from "./category-tree";

/** A `409 CATALOG_CATEGORY_IN_USE`: which Category, and how many active children it still has. */
interface InUse {
  category: Category;
  activeChildren: number;
}

function inUseMessage({ category, activeChildren }: InUse): string {
  // The 409 carries no counts and the tree has no product counts yet (follow-up after BE #61).
  if (activeChildren > 0) {
    return (
      `Chưa lưu trữ được “${category.name}”: còn ${activeChildren} danh mục con chưa lưu trữ, và có thể còn món dùng ` +
      "danh mục này làm danh mục chính. Lưu trữ danh mục con, chuyển các món sang danh mục khác, rồi thử lại."
    );
  }
  return (
    `Chưa lưu trữ được “${category.name}”: còn món dùng danh mục này làm danh mục chính. ` +
    "Chuyển các món sang danh mục khác rồi thử lại."
  );
}

/** D3d screen 20: the Category tree with add/edit, reorder and archive (API 08 §1.2, Decision Y). */
interface CategoryScreenProps {
  /** From the URL (`?archived=1`), so the view can be linked and survives a reload. */
  showArchived: boolean;
  onShowArchivedChange: (show: boolean) => void;
}

export function CategoryScreen({ showArchived, onShowArchivedChange }: CategoryScreenProps) {
  const { permissions } = useWorkspace();
  // UX only: the API answers 403 without CATALOG_MANAGE (Decision M4).
  const canManage = permissions.has("CATALOG_MANAGE");
  // One request feeds the active view, the archived view, their counts and the depth rule (Decision Y3).
  const tree = useCategoryTree(true);
  const reorder = useReorderCategories();
  const archive = useArchiveCategory();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [archiving, setArchiving] = useState<Category | null>(null);
  const [inUse, setInUse] = useState<InUse | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const focusAfterMove = useRef<string | null>(null);

  const all = tree.data;
  const active = all ? activeTree(all) : undefined;
  // Fresh from the cache, so a reload after VERSION_CONFLICT edits the new version.
  const found = editingId && all ? findCategory(all, editingId) : undefined;
  const editing = found && isActive(found) ? found : null;

  // The moved row may be re-inserted in the DOM, which drops focus: put it back on the pressed button.
  // Only while focus is lost; once the user moves on, stop following. No deps on purpose: the row
  // can move on any render (optimistic order, then the server's tree).
  useEffect(() => {
    const target = focusAfterMove.current;
    if (!target) return;
    const lost = document.activeElement === null || document.activeElement === document.body;
    const button = document.querySelector<HTMLElement>(`[data-move="${target}"]`);
    if (lost && button) button.focus();
    else if (document.activeElement !== button) focusAfterMove.current = null;
  });

  function move(category: Category, direction: MoveDirection) {
    if (!all) return;
    const request = moveRequest(all, category.categoryId, direction);
    if (!request) return;
    setInUse(null);
    focusAfterMove.current = `${category.categoryId}:${direction}`;
    const position = request.categoryIds.indexOf(category.categoryId) + 1;
    setAnnouncement(`Đã chuyển ${category.name} ${direction === "up" ? "lên" : "xuống"}, vị trí ${position}.`);
    reorder.mutate(request);
  }

  function confirmArchive() {
    if (!archiving || !all) return;
    const category = archiving;
    archive.mutate(category, {
      onSuccess: () => {
        setArchiving(null);
        setInUse(null);
        if (editingId === category.categoryId) setEditingId(null);
        setAnnouncement(`Đã lưu trữ ${category.name}.`);
      },
      onError: (error) => {
        if (errorCode(error) !== "CATALOG_CATEGORY_IN_USE") return;
        const root = all.find((r) => r.categoryId === category.categoryId);
        setInUse({ category, activeChildren: root?.children.filter(isActive).length ?? 0 });
        setArchiving(null);
      },
    });
  }

  function reload() {
    archive.reset();
    setArchiving(null);
    void tree.refetch();
  }

  const reorderCode = errorCode(reorder.error);

  return (
    <>
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="font-display text-heading-lg text-balance">Danh mục</h1>
        {active ? (
          <span className="text-body text-ink-muted tabular-nums">
            {`${active.length} nhóm · ${active.reduce((n, r) => n + r.children.length, 0)} danh mục con · tối đa 2 cấp`}
          </span>
        ) : null}
      </div>

      <p role="status" className="sr-only">
        {announcement}
      </p>
      {inUse ? (
        <div className="max-w-[820px]">
          <FormAlert tone="danger">{inUseMessage(inUse)}</FormAlert>
        </div>
      ) : null}
      {reorder.isError ? (
        <div className="max-w-[820px]">
          <FormAlert tone={reorderCode === "CATALOG_CATEGORY_ORDER_STALE" ? "warning" : "danger"}>
            {reorderCode === "CATALOG_CATEGORY_ORDER_STALE"
              ? "Danh mục vừa được thay đổi ở nơi khác nên chưa đổi được thứ tự. Cây đã được tải lại, bạn sắp xếp lại nhé."
              : "Chưa đổi được thứ tự. Bạn thử lại sau ít phút nhé."}
          </FormAlert>
        </div>
      ) : null}

      {tree.isError && !all ? (
        <div className="grid justify-items-start gap-2">
          <FormAlert tone="danger">Chưa tải được danh mục. Kiểm tra mạng rồi thử lại.</FormAlert>
          <Button variant="outline" busy={tree.isFetching} onClick={() => void tree.refetch()}>
            Thử lại
          </Button>
        </div>
      ) : (
        <div className={canManage ? "grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]" : "grid"}>
          <TreeCard
            all={all}
            showArchived={showArchived}
            onToggleArchived={() => onShowArchivedChange(!showArchived)}
            canManage={canManage}
            onMove={move}
            onEdit={(category) => setEditingId(category.categoryId)}
            onArchive={(category) => {
              archive.reset();
              setArchiving(category);
            }}
            highlightedId={inUse?.category.categoryId ?? null}
          />
          {canManage && all ? (
            <CategoryForm
              key={editing?.categoryId ?? "new"}
              tree={all}
              editing={editing}
              onDone={() => setEditingId(null)}
              onReload={() => void tree.refetch()}
            />
          ) : null}
        </div>
      )}

      <Dialog.Root
        open={archiving !== null}
        onOpenChange={(open) => {
          if (!open) setArchiving(null);
        }}
      >
        {archiving ? (
          <ArchiveCategoryDialog category={archiving} archive={archive} onConfirm={confirmArchive} onReload={reload} />
        ) : null}
      </Dialog.Root>
    </>
  );
}

interface TreeCardProps {
  all: readonly CategoryNode[] | undefined;
  showArchived: boolean;
  onToggleArchived: () => void;
  canManage: boolean;
  onMove: (category: Category, direction: MoveDirection) => void;
  onEdit: (category: Category) => void;
  onArchive: (category: Category) => void;
  highlightedId: string | null;
}

function TreeCard({ all, showArchived, onToggleArchived, canManage, onMove, onEdit, onArchive, highlightedId }: TreeCardProps) {
  const archivedCount = all ? countArchived(all) : 0;
  const shown = all ? (showArchived ? all : activeTree(all)) : undefined;
  return (
    <Card className="gap-0 overflow-hidden p-0">
      <section aria-labelledby="category-tree-title">
        <div className="flex flex-wrap items-baseline gap-3 border-b border-line px-4 py-3.5">
          <h2 id="category-tree-title" className="text-title">
            Cây danh mục
          </h2>
          <span className="text-label font-normal text-ink-muted">Thứ tự ở đây là thứ tự khách thấy trên menu.</span>
        </div>
        {!shown ? (
          <div className="grid gap-2 p-4">
            <Skeleton className="h-13 w-full" />
            <Skeleton className="h-13 w-full" />
            <Skeleton className="h-13 w-full" />
          </div>
        ) : shown.length === 0 ? (
          <p className="border-b border-line p-6 text-center text-body text-ink-muted">
            {canManage
              ? "Chưa có danh mục nào. Thêm danh mục đầu tiên ở khung bên cạnh."
              : "Chưa có danh mục nào."}
          </p>
        ) : (
          <CategoryTree
            tree={shown}
            onMove={canManage ? onMove : null}
            onEdit={onEdit}
            onArchive={onArchive}
            highlightedId={highlightedId}
          />
        )}
        <p className="px-4 py-3 text-caption text-ink-muted">
          Danh mục đã lưu trữ không hiện trên menu và không chọn làm danh mục chính được.{" "}
          {archivedCount > 0 || showArchived ? (
            <Button variant="link" density="compact" className="h-auto text-caption" aria-pressed={showArchived} onClick={onToggleArchived}>
              {showArchived ? "Ẩn đã lưu trữ" : `Xem đã lưu trữ (${archivedCount})`}
            </Button>
          ) : null}
        </p>
      </section>
    </Card>
  );
}
