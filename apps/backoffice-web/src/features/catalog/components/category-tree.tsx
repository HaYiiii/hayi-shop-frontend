import { Button, StatusBadge, cn, focusRing } from "@hayi/ui";
import { type ReactNode, createContext, use } from "react";
import type { Category, CategoryNode } from "../api/categories";
import { isActive } from "../category-form";

export type MoveDirection = "up" | "down";

interface TreeActions {
  /** `null` hides the move buttons, Sửa and Lưu trữ (no `CATALOG_MANAGE`; UX only). */
  onMove: ((category: Category, direction: MoveDirection) => void) | null;
  onEdit: (category: Category) => void;
  onArchive: (category: Category) => void;
  /** The row the page alert is about (`CATALOG_CATEGORY_IN_USE`). */
  highlightedId: string | null;
}

const TreeContext = createContext<TreeActions | null>(null);

function useTree() {
  const context = use(TreeContext);
  if (!context) throw new Error("Category rows must be inside <CategoryTree>");
  return context;
}

interface CategoryTreeProps extends TreeActions {
  /** Roots in `sortOrder`, archived ones included when shown. */
  tree: readonly CategoryNode[];
}

/** D3d screen 20: the tree, ≤ 2 levels, in the order customers see on the menu. */
export function CategoryTree({ tree, ...actions }: CategoryTreeProps) {
  const activeRoots = tree.filter(isActive);
  return (
    <TreeContext value={actions}>
      <ul aria-label="Danh mục" className="m-0 list-none p-0">
        {tree.map((root) => {
          const activeChildren = root.children.filter(isActive);
          return (
            <li key={root.categoryId}>
              <CategoryRow category={root} siblings={activeRoots} />
              {root.children.length > 0 ? (
                <ul aria-label={`Danh mục con của ${root.name}`} className="m-0 list-none p-0">
                  {root.children.map((child) => (
                    <li key={child.categoryId}>
                      <CategoryRow category={child} siblings={activeChildren} child />
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    </TreeContext>
  );
}

function CategoryRow({ category, siblings, child = false }: { category: Category; siblings: readonly Category[]; child?: boolean }) {
  const { onMove, onEdit, onArchive, highlightedId } = useTree();
  const archived = !isActive(category);
  const index = siblings.findIndex((c) => c.categoryId === category.categoryId);
  return (
    <div
      className={cn(
        "grid min-h-13 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-line px-3 py-1.5",
        child && "bg-cream/50 pl-11",
        highlightedId === category.categoryId && "bg-danger-soft",
      )}
    >
      {onMove && !archived ? (
        <span className="flex flex-col">
          <MoveButton category={category} direction="up" disabled={index <= 0} onMove={onMove} />
          <MoveButton category={category} direction="down" disabled={index === siblings.length - 1} onMove={onMove} />
        </span>
      ) : (
        <span aria-hidden="true" className={onMove ? "w-7" : "hidden"} />
      )}
      <span className="min-w-0">
        <span className={cn("flex flex-wrap items-center gap-2", archived && "text-ink-muted")}>
          <span className={cn("min-w-0 break-words", child ? "text-body font-medium" : "text-body-lg font-semibold")}>{category.name}</span>
          {archived ? <StatusBadge tone="neutral">Đã lưu trữ</StatusBadge> : null}
        </span>
        <span translate="no" className="block break-all font-mono text-label font-semibold tracking-wide text-ink-muted">
          {category.slug}
        </span>
      </span>
      {onMove && !archived ? (
        <span className="flex gap-1">
          <Button variant="ghost" density="compact" aria-label={`Sửa ${category.name}`} onClick={() => onEdit(category)}>
            Sửa
          </Button>
          <Button variant="ghost" density="compact" aria-label={`Lưu trữ ${category.name}…`} onClick={() => onArchive(category)}>
            Lưu trữ…
          </Button>
        </span>
      ) : (
        <span />
      )}
    </div>
  );
}

const arrows: Record<MoveDirection, ReactNode> = {
  up: <path d="m5 12.5 5-5 5 5" />,
  down: <path d="m5 7.5 5 5 5-5" />,
};

/**
 * Stays focusable at the end of its group (`aria-disabled`, D3d screen 20) so the keyboard does not lose
 * its place after the row moves there. `data-move` lets the screen put focus back after the move.
 */
function MoveButton({
  category,
  direction,
  disabled,
  onMove,
}: {
  category: Category;
  direction: MoveDirection;
  disabled: boolean;
  onMove: NonNullable<TreeActions["onMove"]>;
}) {
  return (
    <button
      type="button"
      data-move={`${category.categoryId}:${direction}`}
      aria-label={`Chuyển ${category.name} ${direction === "up" ? "lên" : "xuống"}`}
      aria-disabled={disabled || undefined}
      onClick={() => {
        if (!disabled) onMove(category, direction);
      }}
      className={cn(
        "grid h-5.5 w-7 place-items-center rounded-sm text-ink-muted hover:bg-sunken hover:text-ink",
        "aria-disabled:cursor-not-allowed aria-disabled:text-line-strong aria-disabled:hover:bg-transparent",
        focusRing,
      )}
    >
      <svg aria-hidden="true" viewBox="0 0 20 20" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        {arrows[direction]}
      </svg>
    </button>
  );
}
