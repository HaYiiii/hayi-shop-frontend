import { formatVnd } from "@hayi/domain-utils";
import { Button, Card, Skeleton, StatusBadge, Table } from "@hayi/ui";
import { useQuery } from "@tanstack/react-query";
import { errorCode, useApi } from "../../../lib/api";
import { FormAlert } from "../../../lib/form-alert";
import { productQuery } from "../api/products";
import { findCategory } from "../category-form";
import { useCategoryTree } from "../hooks/use-categories";
import { productStatusLabel, productStatusTone } from "../product-status";
import { ProductBreadcrumb } from "./product-breadcrumb";

/**
 * Read-only Product page, where "Tạo món" lands (FE #46). Editing, sizes and lifecycle come with
 * D3d screen 23 (FE #47), which builds on this page.
 */
export function ProductDetail({ productId, created }: { productId: string; created: boolean }) {
  const api = useApi();
  const { data: product, error, refetch, isFetching } = useQuery(productQuery(api, productId));
  const { data: tree } = useCategoryTree(true);

  if (!product) {
    return (
      <>
        <ProductBreadcrumb current="Món" />
        {errorCode(error) === "CATALOG_PRODUCT_NOT_FOUND" ? (
          <FormAlert tone="danger">Không tìm thấy món này. Có thể đường dẫn đã cũ.</FormAlert>
        ) : error ? (
          <div className="grid justify-items-start gap-2">
            <FormAlert tone="danger">Chưa tải được món. Kiểm tra mạng rồi thử lại.</FormAlert>
            <Button variant="outline" busy={isFetching} onClick={() => void refetch()}>
              Thử lại
            </Button>
          </div>
        ) : (
          <Skeleton className="h-60 w-full" />
        )}
      </>
    );
  }

  const category = product.primaryCategoryId ? findCategory(tree ?? [], product.primaryCategoryId) : undefined;
  const variants = product.variants.filter((v) => v.status !== "ARCHIVED");

  return (
    <>
      <ProductBreadcrumb current={product.name} />
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-heading-lg break-words">{product.name}</h1>
        <StatusBadge tone={productStatusTone[product.status]} dot>
          {productStatusLabel[product.status]}
        </StatusBadge>
      </div>
      {created ? <FormAlert tone="success">Đã tạo món ở trạng thái Nháp.</FormAlert> : null}

      <Card className="max-w-[860px] gap-5 p-6">
        <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-6 gap-y-2 text-body">
          <dt className="text-ink-muted">Mã món</dt>
          <dd translate="no" className="font-mono font-semibold tracking-wide">
            {product.productCode}
          </dd>
          <dt className="text-ink-muted">Đường dẫn</dt>
          <dd translate="no" className="font-mono break-all">
            {product.slug}
          </dd>
          <dt className="text-ink-muted">Danh mục chính</dt>
          <dd className={category ? undefined : "text-ink-muted"}>{category?.name ?? "Chưa chọn"}</dd>
          {product.shortDescription ? (
            <>
              <dt className="text-ink-muted">Mô tả ngắn</dt>
              <dd className="break-words">{product.shortDescription}</dd>
            </>
          ) : null}
        </dl>

        <Table.Root aria-label="Size và giá gốc">
          <Table.Head>
            <Table.Row>
              <Table.HeaderCell>Mã SKU</Table.HeaderCell>
              <Table.HeaderCell>Tên size</Table.HeaderCell>
              <Table.HeaderCell numeric>Giá gốc</Table.HeaderCell>
              <Table.HeaderCell>
                <span className="sr-only">Mặc định</span>
              </Table.HeaderCell>
            </Table.Row>
          </Table.Head>
          <Table.Body>
            {variants.map((variant) => (
              <Table.Row key={variant.variantId}>
                <Table.Cell translate="no" className="font-mono font-semibold tracking-wide">
                  {variant.sku}
                </Table.Cell>
                <Table.Cell>{variant.name}</Table.Cell>
                <Table.Cell numeric>{formatVnd(variant.basePrice)}</Table.Cell>
                <Table.Cell>
                  {variant.isDefault ? (
                    <StatusBadge tone="brand">Mặc định</StatusBadge>
                  ) : null}
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
      </Card>
    </>
  );
}
