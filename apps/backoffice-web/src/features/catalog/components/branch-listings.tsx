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
  type OptionItemListing,
  listingKeys,
  listingsQuery,
  optionItemListingKeys,
  optionItemListingsQuery,
  putListing,
  putOptionItemListing,
  putVariantListing,
} from "../api/listings";
import { optionGroupsQuery } from "../api/option-groups";
import { productQuery } from "../api/products";
import {
  type OptionPriceRow,
  type SizePriceRow,
  isSelling,
  listingStateLabel,
  listingStateTone,
  optionChanges,
  optionErrors,
  optionRowsOf,
  priceSummary,
  rebaseOptionRows,
  sizeChanges,
  sizeErrors,
  rebaseSizes,
  sizeRowsOf,
  sizesEdited,
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
    case "CATALOG_OPTION_ARCHIVED":
    case "CATALOG_OPTION_ITEM_NOT_FOUND":
      return { tone: "warning", text: "Một lựa chọn vừa được lưu trữ hoặc gỡ ở thư viện tuỳ chọn. Tải lại rồi thử lại.", reload: true };
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
  const [reloadRound, setReloadRound] = useState(0);

  const queryClient = useQueryClient();
  const reload = () => {
    setNotice(null);
    setReloadRound((n) => n + 1);
    void refetch();
    void queryClient.invalidateQueries({ queryKey: optionItemListingKeys.all(branchId) });
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
                          reloadRound={reloadRound}
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
  const current = listingKeys.list(branchId, filters);
  return (next: BranchListingRow) => {
    queryClient.setQueryData(current, (page: { items: BranchListingRow[] } | undefined) =>
      page ? { ...page, items: page.items.map((r) => (r.productId === next.productId ? next : r)) } : page,
    );
    // Other pages and searches may hold the same Product: they load again when next shown.
    void queryClient.invalidateQueries({
      queryKey: listingKeys.all(branchId),
      predicate: (query) => JSON.stringify(query.queryKey) !== JSON.stringify(current),
      refetchType: "none",
    });
  };
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
            <Button variant="ghost" density="compact" aria-label={`Gỡ bán ${row.name}`} busy={command.isPending} onClick={() => command.mutate("NOT_AVAILABLE")}>
              Gỡ bán
            </Button>
          ) : (
            <Button variant="outline" density="compact" aria-label={`Bật bán ${row.name}`} busy={command.isPending} onClick={() => command.mutate("AVAILABLE")}>
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
  /** Counts "Tải lại" clicks: the next newer version is merged under what is typed. */
  reloadRound: number;
}

/** Branch price per size (full price, empty = base) and whether the size is sold here (AD2, AD4). */
function SizePrices({ row, branchId, filters, canManage, onNotice, branchName, reloadRound }: SizePricesProps) {
  const api = useApi();
  const putRow = usePutRow(branchId, filters);
  const listing = row.listing!;
  const [rows, setRows] = useState<SizePriceRow[]>(() => sizeRowsOf(listing));
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  // The listing the rows were made from; its version goes as `If-Match` with the next save (the #35 pattern).
  const [base, setBase] = useState(listing);
  const [seenReload, setSeenReload] = useState(reloadRound);

  // Option items of the Product with their Branch extra price (AD3, Decision AM); loaded when the row opens.
  const queryClient = useQueryClient();
  const product = useQuery(productQuery(api, row.productId));
  const library = useQuery(optionGroupsQuery(api));
  const optionListings = useQuery(optionItemListingsQuery(api, branchId));
  const freshOptions =
    product.data && library.data && optionListings.data ? optionRowsOf(product.data, library.data, optionListings.data) : null;
  const [optionRows, setOptionRows] = useState<OptionPriceRow[] | null>(null);
  const [optionBase, setOptionBase] = useState<OptionPriceRow[] | null>(null);
  const [seenOptionReload, setSeenOptionReload] = useState(reloadRound);

  const save = useMutation({
    mutationFn: async () => {
      let current = base;
      // One request per size; each answers the listing with its next version (AD2). What went through
      // becomes the base, so after a failure the next save sends only the rest.
      for (const change of sizeChanges(base, rows)) {
        const next = await putVariantListing(api, branchId, row.productId, change.variantId, current.version, change.body);
        current = next.listing!;
        setBase(current);
        putRow(next);
      }
      // Then one request per option item, each with that item's own version ("v0" creates it, AD3).
      let options = optionBase;
      for (const change of options && optionRows ? optionChanges(options, optionRows) : []) {
        const saved = await putOptionItemListing(api, branchId, change.optionItemId, change.version, change.extraPrice);
        options = options!.map((o) =>
          o.optionItemId === saved.optionItemId
            ? { ...o, version: saved.version, price: saved.extraPrice === null ? "" : formatVnd(saved.extraPrice) }
            : o,
        );
        setOptionBase(options);
        queryClient.setQueryData(optionItemListingKeys.all(branchId), (list: OptionItemListing[] | undefined) =>
          list ? [...list.filter((l) => l.optionItemId !== saved.optionItemId), saved] : [saved],
        );
      }
      return { current, options };
    },
    onMutate: () => onNotice(null),
    onSuccess: ({ current, options }) => {
      setRows((typed) => rebaseSizes(typed, current, current));
      if (options) setOptionRows(options);
      onNotice({ tone: "success", text: `Đã lưu giá của ${row.name} tại ${branchName}. Khách thấy giá mới trên menu sau khoảng một phút.` });
    },
    onError: (error) => onNotice(failureNotice(error)),
  });

  // The #35 pattern for option prices too: adopt a newer state when nothing is typed, rebase it on "Tải lại".
  if (freshOptions && !save.isPending) {
    if (optionBase === null || optionRows === null) {
      setOptionBase(freshOptions);
      setOptionRows(freshOptions);
    } else if (JSON.stringify(freshOptions) !== JSON.stringify(optionBase)) {
      if (reloadRound !== seenOptionReload) {
        setSeenOptionReload(reloadRound);
        setOptionRows(rebaseOptionRows(optionRows, optionBase, freshOptions));
        setOptionBase(freshOptions);
      } else if (JSON.stringify(optionRows) === JSON.stringify(optionBase)) {
        setOptionRows(freshOptions);
        setOptionBase(freshOptions);
      }
    }
  }
  if (listing.version !== base.version && !save.isPending) {
    if (reloadRound !== seenReload) {
      // "Tải lại": the new version under what is typed; the next save uses its `If-Match`.
      setSeenReload(reloadRound);
      setRows(rebaseSizes(rows, base, listing));
      setBase(listing);
    } else if (!sizesEdited(rows, base)) {
      // Nothing typed: take the newer version as it is.
      setRows(sizeRowsOf(listing));
      setBase(listing);
    }
    // Over typed prices, the old version stays: the save gets 412 and offers "Tải lại".
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const found = { ...sizeErrors(rows), ...(optionRows ? optionErrors(optionRows) : {}) };
    // Rendered first, so the keyboard can go to the first marked price.
    flushSync(() => setErrors(found));
    if (Object.keys(found).length > 0) {
      const first = Object.keys(found)[0];
      form.querySelector<HTMLElement>(`[data-price="${first}"]`)?.focus();
      return;
    }
    const optionCount = optionBase && optionRows ? optionChanges(optionBase, optionRows).length : 0;
    if (sizeChanges(base, rows).length === 0 && optionCount === 0) {
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
                    data-price={size.variantId}
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
      <p className="text-caption text-ink-muted">
        Giá tại chi nhánh là giá đầy đủ khách trả, không phải phần cộng thêm. Để trống để dùng giá gốc.
      </p>

      {optionRows === null ? (
        product.isError || library.isError || optionListings.isError ? (
          <FormAlert tone="danger">Chưa tải được giá tuỳ chọn. Bấm Tải lại để thử lại.</FormAlert>
        ) : (
          <Skeleton className="h-20 w-full" />
        )
      ) : optionRows.length > 0 ? (
        <div className="grid gap-2">
          <Table.Root aria-label={`Tuỳ chọn của ${row.name}`}>
            <Table.Head>
              <Table.Row>
                <Table.HeaderCell>Lựa chọn</Table.HeaderCell>
                <Table.HeaderCell numeric>Giá thêm ở món</Table.HeaderCell>
                <Table.HeaderCell>Giá thêm tại chi nhánh</Table.HeaderCell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {optionRows.map((option) => (
                <Table.Row key={option.optionItemId}>
                  <Table.Cell>
                    <span className="block font-medium">{option.name}</span>
                    <span className="block text-caption text-ink-muted">{`Lựa chọn của nhóm ${option.groupName}`}</span>
                  </Table.Cell>
                  <Table.Cell numeric>{`+${formatVnd(option.productPrice)}`}</Table.Cell>
                  <Table.Cell>
                    <Field.Root className="gap-1">
                      <Field.Label className="sr-only">{`Giá thêm ${option.name} tại chi nhánh (đồng)`}</Field.Label>
                      <Field.Input
                        inputMode="numeric"
                        autoComplete="off"
                        data-price={option.optionItemId}
                        placeholder="Như món"
                        readOnly={!canManage}
                        className="w-36 tabular-nums"
                        value={option.price}
                        onChange={(e) => {
                          const price = e.currentTarget.value;
                          setOptionRows((os) => os && os.map((o) => (o.optionItemId === option.optionItemId ? { ...o, price } : o)));
                        }}
                        onBlur={(e) => {
                          const amount = parsePrice(e.currentTarget.value);
                          if (amount === null) return;
                          setOptionRows((os) =>
                            os && os.map((o) => (o.optionItemId === option.optionItemId ? { ...o, price: formatVnd(amount) } : o)),
                          );
                        }}
                      />
                      {errors[option.optionItemId] ? <Field.Error aria-live="polite">{errors[option.optionItemId]}</Field.Error> : null}
                    </Field.Root>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
          <p className="text-caption text-ink-muted">
            Giá thêm tại chi nhánh đặt theo lựa chọn: áp cho mọi món dùng lựa chọn này ở chi nhánh. Để trống để như món.
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {canManage ? (
          <span className="ml-auto flex gap-2">
            <Button
              variant="ghost"
              density="compact"
              onClick={() => {
                setRows(sizeRowsOf(base));
                setOptionRows(optionBase);
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
