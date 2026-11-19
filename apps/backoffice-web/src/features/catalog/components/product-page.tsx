import { formatBranchDate } from "@hayi/domain-utils";
import { Button, Dialog, Skeleton, StatusBadge, Summary, cn, focusRing } from "@hayi/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { type ReactNode, createContext, use, useState } from "react";
import { errorCode, useApi } from "../../../lib/api";
import { FormAlert } from "../../../lib/form-alert";
import { useWorkspace } from "../../../lib/workspace";
import { type Product, type ProductCommand, type ProductStatus, productKeys, productQuery, runProductCommand } from "../api/products";
import type { CategoryNode } from "../api/categories";
import { findCategory } from "../category-form";
import { useCategoryTree } from "../hooks/use-categories";
import { type ActivationIssue, activationIssues } from "../product-editor";
import { productStatusLabel, productStatusTone } from "../product-status";
import { ProductBreadcrumb } from "./product-breadcrumb";
import { groupHeadingId } from "../product-options";

export type Notice = { tone: "success" | "danger" | "warning"; text: string; reload?: boolean };

interface ProductPageValue {
  product: Product;
  /** UX only: the API answers 403 (Decision M4). */
  canManage: boolean;
  /** `CATALOG_PRICE_MANAGE`: base prices and new sizes (Decision Z4). */
  canPrice: boolean;
  /** One message area for the page: lifecycle commands and the tab's own saves. */
  setNotice: (notice: Notice | null) => void;
  /** `issues[]` of a `422 PRODUCT_ACTIVATION_INVALID`, listed above the tab; `null` hides them. */
  setIssues: (issues: ActivationIssue[] | null) => void;
  /** Reloads the Product; resolves with the new version. */
  reload: () => Promise<Product | undefined>;
}

const ProductPageContext = createContext<ProductPageValue | null>(null);

/** The Product of the page, for a tab inside `<ProductPage>`. */
export function useProductPage(): ProductPageValue {
  const value = use(ProductPageContext);
  if (!value) throw new Error("useProductPage must be used inside <ProductPage>");
  return value;
}

const tabClass = cn(
  "-mb-px rounded-t-md border-b-2 border-transparent px-3 py-2 text-body font-medium text-ink-muted no-underline hover:text-ink",
  "aria-[current=page]:border-matcha-700 aria-[current=page]:font-semibold aria-[current=page]:text-matcha-800",
  focusRing,
);

interface ProductPageProps {
  productId: string;
  /** The Product was just created here: a confirmation shows once (the route drops the flag from the URL). */
  created: boolean;
  children: ReactNode;
}

/**
 * D3d screen 23: a Product's header (status, lifecycle commands, lifecycle steps) and the tabs
 * around the open one. Screens 24–26 add their tab to `ProductTabs`.
 */
export function ProductPage({ productId, created, children }: ProductPageProps) {
  const api = useApi();
  const { permissions } = useWorkspace();
  const { data: product, error, refetch, isFetching } = useQuery(productQuery(api, productId));
  // Kept here, inside the page keyed by Product: another Product's page starts without it.
  const [showCreated, setShowCreated] = useState(created);
  const [notice, setNoticeState] = useState<Notice | null>(null);
  const [issues, setIssues] = useState<ActivationIssue[] | null>(null);

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

  const setNotice = (next: Notice | null) => {
    setShowCreated(false);
    setNoticeState(next);
  };
  const reload = async () => {
    setNotice(null);
    setIssues(null);
    return (await refetch()).data;
  };
  const value: ProductPageValue = {
    product,
    canManage: permissions.has("CATALOG_MANAGE"),
    canPrice: permissions.has("CATALOG_PRICE_MANAGE"),
    setNotice,
    setIssues,
    reload,
  };

  return (
    <ProductPageContext value={value}>
      <ProductBreadcrumb current={product.name} />
      <section aria-label="Tóm tắt món" className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-heading-lg break-words text-balance">{product.name}</h1>
        <span translate="no" className="font-mono text-label font-semibold tracking-wide text-ink-muted">
          {product.productCode}
        </span>
        <StatusBadge tone={productStatusTone[product.status]} dot>
          {productStatusLabel[product.status]}
        </StatusBadge>
        {value.canManage ? <LifecycleActions /> : null}
      </section>
      <Summary.Root role="group" aria-label="Vòng đời và cập nhật" className="-mt-1 tabular-nums">
        <Summary.Steps label={`Vòng đời: đang ở ${productStatusLabel[product.status]}`} steps={lifecycleSteps} current={product.status} />
        <Summary.Item>Cập nhật {formatBranchDate(product.updatedAt)}</Summary.Item>
      </Summary.Root>
      {product.status === "DRAFT" || product.status === "INACTIVE" ? (
        <p className="max-w-prose text-label font-normal text-ink-muted">
          Kích hoạt cần: ít nhất một size đang bán, danh mục chính đang dùng, và tuỳ chọn hợp lệ. Khách chỉ thấy món sau khi
          kích hoạt và chi nhánh bật bán.
        </p>
      ) : null}

      <ProductTabs product={product} onSwitch={() => setNotice(null)} />

      {showCreated ? <FormAlert tone="success">Đã tạo món ở trạng thái Nháp.</FormAlert> : null}
      {notice ? (
        <div className="grid max-w-[860px] justify-items-start gap-2">
          <FormAlert tone={notice.tone}>{notice.text}</FormAlert>
          {notice.reload ? (
            <Button variant="outline" density="compact" onClick={() => void reload()}>
              Tải lại
            </Button>
          ) : null}
        </div>
      ) : null}
      {issues ? <ActivationIssues product={product} issues={issues} /> : null}

      {children}
    </ProductPageContext>
  );
}

/** The Product's sections; only the ones that exist so far (agreed 2026-11-19: #48, #49 … add theirs). */
function ProductTabs({ product, onSwitch }: { product: Product; onSwitch: () => void }) {
  const params = { id: product.productId };
  return (
    <nav aria-label="Phần của món" className="flex gap-1 border-b border-line">
      <Link to="/admin/products/$id" params={params} activeOptions={{ exact: true }} className={tabClass} onClick={onSwitch}>
        Thông tin &amp; size
      </Link>
      <Link
        to="/admin/products/$id/options"
        params={params}
        aria-label={`Tuỳ chọn ${product.optionGroups.length} nhóm`}
        className={tabClass}
        onClick={onSwitch}
      >
        Tuỳ chọn
        <span className="ml-1.5 rounded-full bg-sunken px-1.5 text-caption font-semibold tabular-nums">{product.optionGroups.length}</span>
      </Link>
    </nav>
  );
}

// INACTIVE can go back to ACTIVE; ARCHIVED is final (Catalog §5.2, Decision AA).
const lifecycleSteps = [
  { key: "DRAFT", label: productStatusLabel.DRAFT },
  { key: "ACTIVE", label: productStatusLabel.ACTIVE, connector: "⇄" },
  { key: "INACTIVE", label: productStatusLabel.INACTIVE },
  { key: "ARCHIVED", label: productStatusLabel.ARCHIVED },
] as const;

const commandsOf: Record<ProductStatus, readonly ProductCommand[]> = {
  DRAFT: ["archive", "activate"],
  ACTIVE: ["deactivate", "archive"],
  INACTIVE: ["archive", "activate"],
  ARCHIVED: [],
};

const doneText: Record<ProductCommand, string> = {
  activate: "Đã kích hoạt món. Khách thấy món ở các chi nhánh đang bật bán.",
  deactivate: "Đã tạm ngưng món. Khách không đặt được món này cho tới khi kích hoạt lại.",
  archive: "Đã lưu trữ món.",
};

const staleText = "Trạng thái món đã thay đổi trong lúc bạn thao tác. Tải lại để xem trạng thái mới nhất.";

function useProductCommand(command: ProductCommand) {
  const api = useApi();
  const queryClient = useQueryClient();
  const { product, setNotice, setIssues } = useProductPage();
  return useMutation({
    mutationFn: () => runProductCommand(api, product, command),
    onMutate: () => {
      setNotice(null);
      setIssues(null);
    },
    onSuccess: (next) => {
      queryClient.setQueryData(productKeys.detail(next.productId), next);
      void queryClient.invalidateQueries({ queryKey: [...productKeys.all, "list"] });
      setNotice({ tone: "success", text: doneText[command] });
    },
  });
}

/** Commands for the current status; deactivate and archive confirm in a dialog. */
function LifecycleActions() {
  const { product } = useProductPage();
  const commands = commandsOf[product.status];
  if (commands.length === 0) return null;
  return (
    <div role="group" aria-label="Thao tác vòng đời" className="ml-auto flex flex-wrap gap-2">
      {commands.map((command) =>
        command === "activate" ? <ActivateButton key={command} /> : <ConfirmCommand key={command} command={command} />,
      )}
    </div>
  );
}

function ActivateButton() {
  const { setNotice, setIssues } = useProductPage();
  const activate = useProductCommand("activate");
  return (
    <Button
      busy={activate.isPending}
      onClick={() =>
        activate.mutate(undefined, {
          onError: (error) => {
            const issues = activationIssues(error);
            if (issues) setIssues(issues);
            else if (errorCode(error) === "CATALOG_PRODUCT_INVALID_TRANSITION") setNotice({ tone: "danger", text: staleText, reload: true });
            else setNotice({ tone: "danger", text: "Chưa kích hoạt được. Bạn thử lại sau ít phút nhé." });
          },
        })
      }
    >
      Kích hoạt
    </Button>
  );
}

const confirmCopy = {
  deactivate: {
    trigger: "Tạm ngưng…",
    title: (name: string) => `Tạm ngưng ${name}?`,
    body: "Khách không đặt được món này ở mọi chi nhánh cho tới khi bạn kích hoạt lại. Đơn đã đặt không bị ảnh hưởng.",
    confirm: "Tạm ngưng",
  },
  archive: {
    trigger: "Lưu trữ…",
    title: (name: string) => `Lưu trữ ${name}?`,
    body: "Lưu trữ là vĩnh viễn: món không bán lại được và không sửa được nữa. Đơn cũ vẫn giữ tên và giá của món.",
    confirm: "Lưu trữ món",
  },
} as const;

function ConfirmCommand({ command }: { command: "deactivate" | "archive" }) {
  const { product, reload } = useProductPage();
  const [open, setOpen] = useState(false);
  const run = useProductCommand(command);
  const copy = confirmCopy[command];
  const stale = errorCode(run.error) === "CATALOG_PRODUCT_INVALID_TRANSITION";
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) run.reset();
      }}
    >
      <Dialog.Trigger asChild>
        <Button variant={command === "archive" ? "ghost" : "outline"}>{copy.trigger}</Button>
      </Dialog.Trigger>
      <Dialog.Content className="w-[min(calc(100%-32px),440px)] p-6">
        <Dialog.Title>{copy.title(product.name)}</Dialog.Title>
        <Dialog.Description className="text-ink">{stale ? staleText : copy.body}</Dialog.Description>
        {run.isError && !stale ? <FormAlert tone="danger">Chưa thực hiện được. Bạn thử lại sau ít phút nhé.</FormAlert> : null}
        <Dialog.Actions>
          {stale ? (
            <Button
              onClick={() => {
                setOpen(false);
                void reload();
              }}
            >
              Tải lại
            </Button>
          ) : (
            <>
              <Dialog.Close asChild>
                <Button variant="ghost">Huỷ</Button>
              </Dialog.Close>
              <Button
                variant={command === "archive" ? "danger" : "primary"}
                busy={run.isPending}
                onClick={() => run.mutate(undefined, { onSuccess: () => setOpen(false) })}
              >
                {copy.confirm}
              </Button>
            </>
          )}
        </Dialog.Actions>
      </Dialog.Content>
    </Dialog.Root>
  );
}

type IssueTab = "/admin/products/$id" | "/admin/products/$id/options";

/** Where each issue is fixed: the tab, and the control there that gets the keyboard (a selector). */
function issueTarget(issue: ActivationIssue): { to: IssueTab; selector: string } | null {
  switch (issue.code) {
    case "NO_ACTIVE_VARIANT":
      return { to: "/admin/products/$id", selector: "#product-sizes" };
    case "PRIMARY_CATEGORY_MISSING":
    case "PRIMARY_CATEGORY_INACTIVE":
      return { to: "/admin/products/$id", selector: '[name="primaryCategoryId"]' };
    case "OPTION_CONFIG_INVALID":
      return issue.optionGroupId ? { to: "/admin/products/$id/options", selector: `#${groupHeadingId(issue.optionGroupId)}` } : null;
  }
}

/** Focuses `selector` once the tab has rendered it (another tab may still be loading its data). */
function focusWhenShown(selector: string, framesLeft = 60) {
  requestAnimationFrame(() => {
    const element = document.querySelector<HTMLElement>(selector);
    if (element) {
      element.scrollIntoView?.({ block: "center" });
      element.focus();
    } else if (framesLeft > 0) {
      focusWhenShown(selector, framesLeft - 1);
    }
  });
}

function issueText(issue: ActivationIssue, product: Product, tree: readonly CategoryNode[]): string {
  switch (issue.code) {
    case "NO_ACTIVE_VARIANT":
      return "Món chưa có size nào đang bán. Thêm size ở mục Size và giá gốc.";
    case "PRIMARY_CATEGORY_MISSING":
      return "Món chưa có danh mục chính. Chọn danh mục chính ở dưới.";
    case "PRIMARY_CATEGORY_INACTIVE": {
      const name = product.primaryCategoryId ? findCategory(tree, product.primaryCategoryId)?.name : undefined;
      return name ? `Danh mục chính “${name}” đã lưu trữ. Chọn danh mục khác ở dưới.` : "Danh mục chính đã lưu trữ. Chọn danh mục khác ở dưới.";
    }
    case "OPTION_CONFIG_INVALID": {
      const group = product.optionGroups.find((g) => g.optionGroupId === issue.optionGroupId);
      return group
        ? `Nhóm tuỳ chọn “${group.name}” chưa hợp lệ với món này (đã lưu trữ, hoặc tối thiểu/tối đa không khớp số lựa chọn đang hiện). Sửa ở tab Tuỳ chọn.`
        : "Một nhóm tuỳ chọn của món chưa hợp lệ (đã lưu trữ, hoặc tối thiểu/tối đa không khớp số lựa chọn đang hiện). Sửa ở tab Tuỳ chọn.";
    }
  }
}

/** D3d screen 23 "activationInvalid": what blocks activation, each with a way to the field to fix. */
function ActivationIssues({ product, issues }: { product: Product; issues: ActivationIssue[] }) {
  const { data: tree } = useCategoryTree(true);
  return (
    <div role="alert" className="grid max-w-[860px] gap-2 rounded-md bg-danger-soft p-4 text-label text-ink">
      <p className="font-semibold text-danger">Chưa kích hoạt được món này. Sửa các mục sau rồi kích hoạt lại:</p>
      <ul className="grid list-disc gap-1 pl-5">
        {issues.map((issue, i) => {
          const target = issueTarget(issue);
          return (
            <li key={`${issue.code}-${issue.optionGroupId ?? i}`}>
              {issueText(issue, product, tree ?? [])}{" "}
              {target ? (
                <Link
                  to={target.to}
                  params={{ id: product.productId }}
                  className={cn("font-semibold text-matcha-700 underline underline-offset-2", focusRing)}
                  onClick={() => focusWhenShown(target.selector)}
                >
                  Sửa ngay
                </Link>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
