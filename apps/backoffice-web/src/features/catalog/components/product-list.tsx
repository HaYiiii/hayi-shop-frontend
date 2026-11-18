import { formatBranchDate } from "@hayi/domain-utils";
import { Button, Chip, ChipGroup, Field, Skeleton, StatusBadge, Table, cn, focusRing } from "@hayi/ui";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useApi } from "../../../lib/api";
import { FormAlert } from "../../../lib/form-alert";
import { useWorkspace } from "../../../lib/workspace";
import type { CategoryNode } from "../api/categories";
import { PAGE_SIZE, type ProductFilters, type ProductSummary, productsQuery } from "../api/products";
import { activeTree } from "../category-form";
import { useCategoryTree } from "../hooks/use-categories";
import { priceSummary, productStatusLabel, productStatusOrder, productStatusTone } from "../product-status";

interface ProductListProps {
  /** Filters from the URL. */
  filters: ProductFilters;
  /** New filters; any change but the page goes back to the first page. */
  onFiltersChange: (filters: ProductFilters) => void;
}

const SEARCH_DELAY_MS = 300;

/** D3d screen 21: brand-level Products, filtered and paged on the server (API 08 §1.3). */
export function ProductList({ filters, onFiltersChange }: ProductListProps) {
  const api = useApi();
  const { permissions } = useWorkspace();
  const canCreate = permissions.has("CATALOG_MANAGE") && permissions.has("CATALOG_PRICE_MANAGE");
  const { data, error, refetch, isFetching } = useQuery(productsQuery(api, filters));
  // Archived Categories too: a Product may still point at one.
  const { data: tree } = useCategoryTree(true);
  const filtered = Boolean(filters.status || filters.categoryId || filters.q);

  const change = (next: Omit<ProductFilters, "page">) => onFiltersChange({ ...filters, ...next, page: undefined });

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-heading-lg text-balance">Món</h1>
        {data ? <span className="text-body text-ink-muted tabular-nums">{data.page.totalItems} món</span> : null}
        {canCreate ? (
          <Button asChild className="ml-auto no-underline">
            <Link to="/admin/products/new">Tạo món</Link>
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <ChipGroup aria-label="Lọc theo trạng thái">
          <Chip className="h-8" pressed={!filters.status} onClick={() => change({ status: undefined })}>
            Tất cả
          </Chip>
          {productStatusOrder.map((status) => (
            <Chip key={status} className="h-8" pressed={filters.status === status} onClick={() => change({ status })}>
              {productStatusLabel[status]}
            </Chip>
          ))}
        </ChipGroup>
        <div className="ml-auto flex flex-wrap gap-3">
          <CategoryFilter tree={tree} value={filters.categoryId} onChange={(categoryId) => change({ categoryId })} />
          <SearchFilter value={filters.q} onChange={(q) => change({ q })} />
        </div>
      </div>

      {error && !data ? (
        <div className="grid justify-items-start gap-2">
          <FormAlert tone="danger">Chưa tải được danh sách món. Kiểm tra mạng rồi thử lại.</FormAlert>
          <Button variant="outline" busy={isFetching} onClick={() => void refetch()}>
            Thử lại
          </Button>
        </div>
      ) : !data ? (
        <Skeleton className="h-60 w-full" />
      ) : data.items.length === 0 ? (
        <p role="status" className="rounded-lg border border-dashed border-line-strong bg-paper p-6 text-center text-body text-ink-muted">
          {filtered ? "Không có món nào khớp bộ lọc." : "Chưa có món nào. Bấm Tạo món để thêm món đầu tiên."}
        </p>
      ) : (
        <>
          <ProductTable products={data.items} tree={tree} busy={isFetching} />
          <Pager
            page={data.page.number}
            totalItems={data.page.totalItems}
            totalPages={data.page.totalPages}
            onPage={(page) => onFiltersChange({ ...filters, page: page || undefined })}
          />
        </>
      )}

      <p className="text-caption text-ink-muted">
        Món ở đây dùng chung cho mọi chi nhánh. Mỗi chi nhánh tự bật bán và đặt giá riêng ở “Món bán tại chi nhánh”. Món đã có
        đơn không xoá được, chỉ lưu trữ.
      </p>
    </>
  );
}

function CategoryFilter({
  tree,
  value,
  onChange,
}: {
  tree: CategoryNode[] | undefined;
  value: string | undefined;
  onChange: (categoryId: string | undefined) => void;
}) {
  return (
    <Field.Root className="w-[200px]">
      <Field.Label className="sr-only">Danh mục</Field.Label>
      <Field.Select name="categoryId" value={value ?? ""} onChange={(e) => onChange(e.currentTarget.value || undefined)}>
        <option value="">Mọi danh mục</option>
        {activeTree(tree ?? []).flatMap((root) => [
          <option key={root.categoryId} value={root.categoryId}>
            {root.name}
          </option>,
          ...root.children.map((child) => (
            <option key={child.categoryId} value={child.categoryId}>
              {`— ${child.name}`}
            </option>
          )),
        ])}
      </Field.Select>
    </Field.Root>
  );
}

/** Typed text goes to the URL after a short pause, so each key does not load a page. */
function SearchFilter({ value, onChange }: { value: string | undefined; onChange: (q: string | undefined) => void }) {
  const [text, setText] = useState(value ?? "");
  useEffect(() => {
    const q = text.trim() || undefined;
    if (q === value) return;
    const timer = setTimeout(() => onChange(q), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [text, value, onChange]);

  return (
    <Field.Root className="w-[240px]">
      <Field.Label className="sr-only">Tìm món</Field.Label>
      <Field.Input
        type="search"
        name="q"
        autoComplete="off"
        spellCheck={false}
        maxLength={100}
        placeholder="Tìm theo tên hoặc mã…"
        value={text}
        onChange={(e) => setText(e.currentTarget.value)}
      />
    </Field.Root>
  );
}

function ProductTable({ products, tree, busy }: { products: ProductSummary[]; tree: CategoryNode[] | undefined; busy: boolean }) {
  const categoryName = useMemo(() => {
    const names = new Map<string, string>();
    for (const root of tree ?? []) {
      names.set(root.categoryId, root.name);
      for (const child of root.children) names.set(child.categoryId, child.name);
    }
    return names;
  }, [tree]);

  return (
    <Table.Root aria-label="Danh sách món" aria-busy={busy || undefined}>
      <Table.Head>
        <Table.Row>
          <Table.HeaderCell>Món</Table.HeaderCell>
          <Table.HeaderCell>Danh mục chính</Table.HeaderCell>
          <Table.HeaderCell>Size · giá gốc</Table.HeaderCell>
          <Table.HeaderCell>Trạng thái</Table.HeaderCell>
          <Table.HeaderCell>Cập nhật</Table.HeaderCell>
          <Table.HeaderCell>
            <span className="sr-only">Mở</span>
          </Table.HeaderCell>
        </Table.Row>
      </Table.Head>
      <Table.Body>
        {products.map((product) => {
          const archived = product.status === "ARCHIVED";
          const category = product.primaryCategoryId ? categoryName.get(product.primaryCategoryId) : undefined;
          return (
            <Table.Row key={product.productId} className={archived ? "text-ink-muted" : undefined}>
              <Table.Cell>
                <span className="flex min-w-0 items-center gap-3">
                  <ProductThumb />
                  <span className="min-w-0">
                    <span className="block font-semibold break-words">{product.name}</span>
                    <span translate="no" className="font-mono text-label font-semibold tracking-wide text-ink-muted">
                      {product.productCode}
                    </span>
                  </span>
                </span>
              </Table.Cell>
              <Table.Cell className={category ? undefined : "text-ink-muted"}>
                {product.primaryCategoryId ? (category ?? "…") : "Chưa chọn"}
              </Table.Cell>
              <Table.Cell className="tabular-nums">{priceSummary(product)}</Table.Cell>
              <Table.Cell>
                <StatusBadge tone={productStatusTone[product.status]} dot>
                  {productStatusLabel[product.status]}
                </StatusBadge>
              </Table.Cell>
              <Table.Cell className="text-ink-muted tabular-nums">{formatBranchDate(product.updatedAt)}</Table.Cell>
              <Table.Cell className="text-right">
                <Link
                  to="/admin/products/$id"
                  params={{ id: product.productId }}
                  aria-label={`Xem ${product.name}`}
                  className={cn("rounded-sm font-medium text-matcha-700 hover:text-matcha-800", focusRing)}
                >
                  Xem
                </Link>
              </Table.Cell>
            </Table.Row>
          );
        })}
      </Table.Body>
    </Table.Root>
  );
}

/** Placeholder until images come (FE #49). */
function ProductThumb() {
  return (
    <span aria-hidden="true" className="grid size-10 flex-none place-items-center rounded-md bg-sunken text-ink-subtle">
      <svg viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round">
        <path d="M5 6h10l-1 11H6L5 6Z M4 6h12 M8 3h4" />
      </svg>
    </span>
  );
}

function Pager({
  page,
  totalItems,
  totalPages,
  onPage,
}: {
  page: number;
  totalItems: number;
  totalPages: number;
  onPage: (page: number) => void;
}) {
  const first = page * PAGE_SIZE + 1;
  const last = Math.min(totalItems, (page + 1) * PAGE_SIZE);
  const hasPrevious = page > 0;
  const hasNext = page + 1 < totalPages;
  return (
    <div className="flex items-center gap-3">
      <span className="text-caption text-ink-muted tabular-nums">{`${first}–${last} trên ${totalItems} món`}</span>
      <div className="ml-auto flex gap-2">
        <Button
          variant="outline"
          density="compact"
          aria-disabled={!hasPrevious || undefined}
          onClick={() => hasPrevious && onPage(page - 1)}
        >
          Trang trước
        </Button>
        <Button variant="outline" density="compact" aria-disabled={!hasNext || undefined} onClick={() => hasNext && onPage(page + 1)}>
          Trang sau
        </Button>
      </div>
    </div>
  );
}
