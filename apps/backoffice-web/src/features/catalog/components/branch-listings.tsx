import { formatVnd } from "@hayi/domain-utils";
import { Button, Card, Field, Skeleton, StatusBadge, Table } from "@hayi/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, Fragment, useState } from "react";
import { flushSync } from "react-dom";
import { errorCode, useApi } from "../../../lib/api";
import { FormAlert } from "../../../lib/form-alert";
import { PermissionGuard } from "../../../lib/permission-guard";
import { scopeLabel } from "../../../lib/scope";
import { useWorkspace } from "../../../lib/workspace";
import {
  type BranchListingRow,
  type ListingFilters,
  type ListingInput,
  listingKeys,
  listingsQuery,
  putListing,
  putVariantListing,
} from "../api/listings";
import {
  type SizePriceRow,
  isSelling,
  listingStateLabel,
  listingStateTone,
  priceSummary,
  sizeChanges,
  sizeErrors,
  sizeRowsOf,
} from "../listing-form";
import { parsePrice } from "../product-form";
import { Pager, SearchFilter } from "./product-list";

type Notice = { tone: "success" | "danger" | "warning"; text: string; reload?: boolean };

interface BranchListingsProps {
  branchId: string;
  filters: ListingFilters;
  onFiltersChange: (filters: ListingFilters) => void;
}

/** D3d screen 29: what this Branch sells and at which price (API 08 §2.2, Decision AD). */
export function BranchListings(props: BranchListingsProps) {
  return (
    <PermissionGuard permission="CATALOG_VIEW">
      <ListingsScreen {...props} />
    </PermissionGuard>
  );
}

/** Problem codes of the listing commands, in words (API 08 §4). */
function failureNotice(error: unknown): Notice {
  switch (errorCode(error)) {
    case "VERSION_CONFLICT":
      return { tone: "warning", text: "Món vừa được người khác cập nhật ở chi nhánh này. Tải lại rồi thử lại.", reload: true };
    case "CATALOG_PRODUCT_ARCHIVED":
      return { tone: "warning", text: "Món này vừa được lưu trữ nên không bán được nữa. Tải lại để xem danh sách mới.", reload: true };
    case "CATALOG_LISTING_NOT_FOUND":
    case "CATALOG_VARIANT_NOT_FOUND":
      return { tone: "warning", text: "Món hoặc size vừa thay đổi. Tải lại rồi thử lại.", reload: true };
    case "BRANCH_INVALID_TRANSITION":
      return { tone: "danger", text: "Chi nhánh đã đóng nên không đổi được món bán." };
    case "CATALOG_PRICE_NEGATIVE":
      return { tone: "danger", text: "Giá không được âm." };
    default:
      return { tone: "danger", text: "Chưa lưu được. Bạn thử lại sau ít phút nhé." };
  }
}

function ListingsScreen({ branchId, filters, onFiltersChange }: BranchListingsProps) {
  const api = useApi();
  const { permissions, scope, branches } = useWorkspace();
  // UX only: the API answers 403 (Decision AD1: Branch prices need BRANCH_LISTING_MANAGE alone).
  const canManage = permissions.has("BRANCH_LISTING_MANAGE");
  const branchName = scopeLabel(scope, branches);
  const { data, error, refetch, isFetching, isPlaceholderData } = useQuery(listingsQuery(api, branchId, filters));
  const [notice, setNotice] = useState<Notice | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const reload = () => {
    setNotice(null);
    void refetch();
  };

  return (
    <>
      <div className="grid gap-1">
        <h1 className="font-display text-heading-lg text-balance">Món bán tại chi nhánh</h1>
        <p className="text-label font-normal text-ink-muted">{branchName}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SearchFilter value={filters.q} onChange={(q) => onFiltersChange({ q })} />
      </div>

      {notice ? (
        <div className="grid max-w-form justify-items-start gap-2">
          <FormAlert tone={notice.tone}>{notice.text}</FormAlert>
          {notice.reload ? (
            <Button variant="outline" density="compact" onClick={reload}>
              Tải lại
            </Button>
          ) : null}
        </div>
      ) : null}

      {!data ? (
        error ? (
          <div className="grid justify-items-start gap-2">
            <FormAlert tone="danger">Chưa tải được danh sách món. Kiểm tra mạng rồi thử lại.</FormAlert>
            <Button variant="outline" busy={isFetching} onClick={() => void refetch()}>
              Thử lại
            </Button>
          </div>
        ) : (
          <Skeleton className="h-80 w-full" />
        )
      ) : data.items.length === 0 ? (
        <Card className="p-6 text-body text-ink-muted">
          {filters.q ? "Không có món nào khớp với từ khoá." : "Chưa có món nào. Món được tạo ở mục Món của Quản trị."}
        </Card>
      ) : (
        <Card className="gap-0 overflow-hidden p-0" aria-busy={isPlaceholderData || undefined}>
          <Table.Root aria-label="Món tại chi nhánh">
            <Table.Head>
              <Table.Row>
                <Table.HeaderCell className="w-10">
                  <span className="sr-only">Mở rộng</span>
                </Table.HeaderCell>
                <Table.HeaderCell>Món</Table.HeaderCell>
                <Table.HeaderCell>Giá tại chi nhánh</Table.HeaderCell>
                <Table.HeaderCell>Trạng thái tại chi nhánh</Table.HeaderCell>
                <Table.HeaderCell>
                  <span className="sr-only">Thao tác</span>
                </Table.HeaderCell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {data.items.map((row) => (
                <Fragment key={row.productId}>
                  <ListingLine
                    row={row}
                    branchId={branchId}
                    filters={filters}
                    expanded={open === row.productId}
                    canManage={canManage}
                    onToggle={() => setOpen((o) => (o === row.productId ? null : row.productId))}
                    onNotice={setNotice}
                    branchName={branchName}
                  />
                  {open === row.productId && row.listing ? (
                    <Table.Row>
                      <Table.Cell colSpan={5} className="bg-sunken/50">
                        <SizePrices
                          row={row}
                          branchId={branchId}
                          filters={filters}
                          canManage={canManage}
                          onNotice={setNotice}
                          branchName={branchName}
                        />
                      </Table.Cell>
                    </Table.Row>
                  ) : null}
                </Fragment>
              ))}
            </Table.Body>
          </Table.Root>
          <div className="border-t border-line px-4 py-3">
            <Pager
              page={data.page.number}
              totalItems={data.page.totalItems}
              totalPages={data.page.totalPages}
              onPage={(page) => onFiltersChange({ ...filters, page })}
            />
          </div>
        </Card>
      )}

      <p className="max-w-prose text-caption text-ink-muted">
        Món nháp bật bán trước được; khách chỉ thấy khi món đã kích hoạt. Hết hàng và tạm dừng bán đổi ở màn Hết hàng, không đổi ở
        đây. Đổi giá không ảnh hưởng đơn đã đặt.
      </p>
    </>
  );
}

/** The answer of a command, put into the cached page. */
function usePutRow(branchId: string, filters: ListingFilters) {
  const queryClient = useQueryClient();
  return (next: BranchListingRow) =>
    queryClient.setQueryData(listingKeys.list(branchId, filters), (page: { items: BranchListingRow[] } | undefined) =>
      page ? { ...page, items: page.items.map((r) => (r.productId === next.productId ? next : r)) } : page,
    );
}

interface LineProps {
  row: BranchListingRow;
  branchId: string;
  filters: ListingFilters;
  expanded: boolean;
  canManage: boolean;
  onToggle: () => void;
  onNotice: (notice: Notice | null) => void;
  branchName: string;
}

function ListingLine({ row, branchId, filters, expanded, canManage, onToggle, onNotice, branchName }: LineProps) {
  const api = useApi();
  const putRow = usePutRow(branchId, filters);
  const selling = isSelling(row.listing);
  const state = row.listing?.availabilityState ?? "NONE";
  const command = useMutation({
    mutationFn: (to: ListingInput) => putListing(api, branchId, row.productId, row.listing?.version ?? 0, to),
    onMutate: () => onNotice(null),
    onSuccess: (next, to) => {
      putRow(next);
      onNotice({
        tone: "success",
        text: to === "AVAILABLE" ? `Đã bật bán ${row.name} tại ${branchName}.` : `Đã gỡ bán ${row.name} tại ${branchName}.`,
      });
    },
    onError: (error) => onNotice(failureNotice(error)),
  });

  return (
    <Table.Row>
      <Table.Cell>
        {row.listing ? (
          <Button
            variant="ghost"
            density="compact"
            className="w-8 px-0"
            aria-expanded={expanded}
            aria-label={`${expanded ? "Thu gọn" : "Mở rộng"} ${row.name}`}
            onClick={onToggle}
          >
            <svg aria-hidden="true" viewBox="0 0 20 20" className={`size-4 transition-transform ${expanded ? "rotate-90" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="m8 5 5 5-5 5" />
            </svg>
          </Button>
        ) : null}
      </Table.Cell>
      <Table.Cell>
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-medium break-words">{row.name}</span>
          {row.status === "DRAFT" ? <StatusBadge tone="neutral">Món nháp</StatusBadge> : null}
        </span>
        <span translate="no" className="block font-mono text-caption font-semibold tracking-wide text-ink-muted">
          {row.productCode}
        </span>
      </Table.Cell>
      <Table.Cell className="tabular-nums">{priceSummary(row.listing)}</Table.Cell>
      <Table.Cell>
        <StatusBadge tone={listingStateTone[state]} dot>
          {listingStateLabel[state]}
        </StatusBadge>
      </Table.Cell>
      <Table.Cell className="text-right">
        {canManage ? (
          selling ? (
            <Button variant="ghost" density="compact" busy={command.isPending} onClick={() => command.mutate("NOT_AVAILABLE")}>
              Gỡ bán
            </Button>
          ) : (
            <Button variant="outline" density="compact" busy={command.isPending} onClick={() => command.mutate("AVAILABLE")}>
              Bật bán
            </Button>
          )
        ) : null}
      </Table.Cell>
    </Table.Row>
  );
}

interface SizePricesProps {
  row: BranchListingRow;
  branchId: string;
  filters: ListingFilters;
  canManage: boolean;
  onNotice: (notice: Notice | null) => void;
  branchName: string;
}

/** Branch price per size (full price, empty = base) and whether the size is sold here (AD2, AD4). */
function SizePrices({ row, branchId, filters, canManage, onNotice, branchName }: SizePricesProps) {
  const api = useApi();
  const putRow = usePutRow(branchId, filters);
  const listing = row.listing!;
  const [rows, setRows] = useState<SizePriceRow[]>(() => sizeRowsOf(listing));
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  // The version the rows were made from. A newer one (this save's answers, a reload) replaces the rows,
  // except while a save is running: its own answers arrive one size at a time.
  const [base, setBase] = useState(listing.version);
  const save = useMutation({
    mutationFn: async () => {
      let current = row;
      // One request per size; each answers the listing with its next version (AD2).
      for (const change of sizeChanges(listing, rows)) {
        current = await putVariantListing(api, branchId, row.productId, change.variantId, current.listing!.version, change.body);
        putRow(current);
      }
      return current;
    },
    onMutate: () => onNotice(null),
    onSuccess: () =>
      onNotice({ tone: "success", text: `Đã lưu giá của ${row.name} tại ${branchName}. Khách thấy giá mới trên menu sau khoảng một phút.` }),
    onError: (error) => onNotice(failureNotice(error)),
  });
  if (listing.version !== base && !save.isPending) {
    setBase(listing.version);
    setRows(sizeRowsOf(listing));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const found = sizeErrors(rows);
    // Rendered first, so the keyboard can go to the first marked price.
    flushSync(() => setErrors(found));
    if (Object.keys(found).length > 0) {
      const first = Object.keys(found)[0];
      form.querySelector<HTMLElement>(`[data-variant="${first}"]`)?.focus();
      return;
    }
    if (sizeChanges(listing, rows).length === 0) {
      onNotice({ tone: "success", text: "Không có thay đổi nào để lưu." });
      return;
    }
    save.mutate();
  }

  const set = (variantId: string, change: Partial<SizePriceRow>) =>
    setRows((rs) => rs.map((r) => (r.variantId === variantId ? { ...r, ...change } : r)));

  return (
    <form className="grid gap-3 py-2" onSubmit={submit} noValidate aria-label={`Giá ${row.name} tại chi nhánh`}>
      <Table.Root aria-label={`Size của ${row.name}`}>
        <Table.Head>
          <Table.Row>
            <Table.HeaderCell>Size</Table.HeaderCell>
            <Table.HeaderCell numeric>Giá gốc</Table.HeaderCell>
            <Table.HeaderCell>Giá tại chi nhánh</Table.HeaderCell>
            <Table.HeaderCell>Bán size này</Table.HeaderCell>
          </Table.Row>
        </Table.Head>
        <Table.Body>
          {rows.map((size) => (
            <Table.Row key={size.variantId}>
              <Table.Cell className="font-medium">{size.name}</Table.Cell>
              <Table.Cell numeric>{formatVnd(size.basePrice)}</Table.Cell>
              <Table.Cell>
                <Field.Root className="gap-1">
                  <Field.Label className="sr-only">{`Giá size ${size.name} tại chi nhánh (đồng)`}</Field.Label>
                  <Field.Input
                    inputMode="numeric"
                    autoComplete="off"
                    data-variant={size.variantId}
                    placeholder="Như giá gốc"
                    readOnly={!canManage}
                    className="w-36 tabular-nums"
                    value={size.price}
                    onChange={(e) => set(size.variantId, { price: e.currentTarget.value })}
                    onBlur={(e) => {
                      const amount = parsePrice(e.currentTarget.value);
                      if (amount !== null) set(size.variantId, { price: formatVnd(amount) });
                    }}
                  />
                  {errors[size.variantId] ? <Field.Error aria-live="polite">{errors[size.variantId]}</Field.Error> : null}
                </Field.Root>
              </Table.Cell>
              <Table.Cell>
                <label className="flex h-10 cursor-pointer items-center gap-2 text-body has-disabled:cursor-default">
                  <input
                    type="checkbox"
                    checked={size.selling}
                    disabled={!canManage}
                    aria-label={`Bán size ${size.name} tại chi nhánh`}
                    onChange={(e) => set(size.variantId, { selling: e.currentTarget.checked })}
                    className="size-4.5 accent-matcha-700"
                  />
                  <span aria-hidden="true">Bán</span>
                </label>
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-caption text-ink-muted">
          Giá tại chi nhánh là giá đầy đủ khách trả, không phải phần cộng thêm. Để trống để dùng giá gốc.
        </span>
        {canManage ? (
          <span className="ml-auto flex gap-2">
            <Button
              variant="ghost"
              density="compact"
              onClick={() => {
                setRows(sizeRowsOf(listing));
                setErrors({});
              }}
            >
              Bỏ thay đổi
            </Button>
            <Button type="submit" density="compact" busy={save.isPending}>
              Lưu giá
            </Button>
          </span>
        ) : null}
      </div>
    </form>
  );
}
