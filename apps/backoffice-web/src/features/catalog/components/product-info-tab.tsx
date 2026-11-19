import { formatVnd } from "@hayi/domain-utils";
import { Button, Card, Dialog, Field, StatusBadge } from "@hayi/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, type ReactNode, type RefObject, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { errorCode, useApi } from "../../../lib/api";
import { FormAlert } from "../../../lib/form-alert";
import { type Product, addVariant, archiveVariant, productKeys, updateProduct, updateVariant } from "../api/products";
import { activeTree, findCategory } from "../category-form";
import { useCategoryTree } from "../hooks/use-categories";
import {
  DESCRIPTION_MAX,
  type EditorFieldErrors,
  type EditorFieldPath,
  type ErrorSource,
  type ProductEditor,
  type SaveStep,
  type SizeRow,
  activationIssues,
  addSize,
  editorOf,
  fieldOrder,
  isEdited,
  localErrors,
  rebase,
  removeNewSize,
  sameContent,
  savePlan,
  serverErrors,
  setSize,
} from "../product-editor";
import { CODE_MAX, NAME_MAX, SHORT_DESCRIPTION_MAX, SLUG_MAX, VARIANT_MAX, VARIANT_NAME_MAX, parsePrice } from "../product-form";
import { Section } from "./product-create";
import { useProductPage } from "./product-page";

let nextKey = 0;
const newKey = () => `new-size-${++nextKey}`;

/** A request of the save failed; `source` says which field paths its answer refers to. */
class SaveFailure extends Error {
  constructor(
    readonly error: unknown,
    readonly source: ErrorSource,
  ) {
    super("save step failed");
  }
}

const sourceOf = (step: SaveStep): ErrorSource => (step.kind === "product" ? { kind: "product" } : { kind: step.kind, index: step.index });

/** Answers that mean the Product on screen is out of date: "Tải lại". */
const staleCodes = new Set(["VERSION_CONFLICT", "CATALOG_VARIANT_ARCHIVED", "CATALOG_VARIANT_NOT_FOUND", "CATALOG_PRODUCT_INVALID_TRANSITION"]);

/** Columns of a size row (screen 23): SKU · name · base price · default · status · action. */
const rowColumns = "grid grid-cols-[190px_120px_130px_110px_96px_minmax(120px,auto)] items-start gap-2.5";

const sizeStatus = {
  ACTIVE: { label: "Đang bán", tone: "success" },
  INACTIVE: { label: "Ngưng bán", tone: "warning" },
  ARCHIVED: { label: "Lưu trữ", tone: "danger" },
} as const;

/**
 * D3d screen 23, tab "Thông tin & size": name, slug, category, descriptions and the sizes with their
 * base prices. "Lưu thông tin" sends what changed as the requests API 08 §1.7 needs, each with the
 * Product's latest version; a request that fails stops the save and points at its field.
 */
export function ProductInfoTab() {
  const api = useApi();
  const queryClient = useQueryClient();
  const { product, canManage, canPrice, setNotice, setIssues, reload } = useProductPage();
  const { data: tree } = useCategoryTree(true);
  const formRef = useRef<HTMLFormElement>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  const readOnly = !canManage || product.status === "ARCHIVED";

  const [editor, setEditor] = useState<ProductEditor>(() => editorOf(product));
  // The version the editor was made from; its `If-Match` goes with the next save.
  const [base, setBase] = useState<Product>(product);
  if (product.version !== base.version) {
    // A newer version with the same content (a lifecycle command) is safe to save over: edits stay.
    // Other content replaces an untouched editor; over edits, the old version makes the save a 412.
    if (sameContent(product, base)) {
      setBase(product);
    } else if (!isEdited(editor, base)) {
      setBase(product);
      setEditor(editorOf(product));
    }
  }
  const [local, setLocal] = useState<EditorFieldErrors>({});
  const [attempt, setAttempt] = useState(0);
  const [archiving, setArchiving] = useState<SizeRow | null>(null);

  /** The answer of one of this tab's writes: into the cache, and under what is typed. */
  function accept(before: Product, next: Product) {
    queryClient.setQueryData(productKeys.detail(next.productId), next);
    setBase(next);
    setEditor((current) => rebase(current, before, next));
  }

  const save = useMutation({
    mutationFn: async ({ from, steps, rows }: { from: Product; steps: SaveStep[]; rows: readonly SizeRow[] }) => {
      let current = from;
      for (const step of steps) {
        let next: Product;
        try {
          next = await runStep(step, current);
        } catch (error) {
          throw new SaveFailure(error, sourceOf(step));
        }
        // An added size now comes from the server: its draft row goes, or it would show twice.
        if (step.kind === "add") {
          const key = rows[step.index]?.key;
          setEditor((e) => ({ ...e, sizes: e.sizes.filter((s) => s.key !== key) }));
        }
        // What went through stays, with the next version for the next request (Decision AE).
        accept(current, next);
        current = next;
      }
      return current;
    },
    onSuccess: (result) => {
      setEditor(editorOf(result));
      setNotice({ tone: "success", text: "Đã lưu thông tin món." });
      void queryClient.invalidateQueries({ queryKey: [...productKeys.all, "list"] });
    },
    onError: (failure) => {
      const issues = activationIssues(failure instanceof SaveFailure ? failure.error : failure);
      if (issues) setIssues(issues);
    },
  });

  function runStep(step: SaveStep, current: Product): Promise<Product> {
    switch (step.kind) {
      case "product":
        return updateProduct(api, current, step.body);
      case "size":
        return updateVariant(api, current, step.variantId, step.body);
      case "add":
        return addVariant(api, current, step.body);
    }
  }

  const failure = save.error instanceof SaveFailure ? save.error : null;
  const failedError = failure?.error ?? save.error;
  const server = serverErrors(failedError, editor, failure?.source ?? { kind: "product" });
  const errors: EditorFieldErrors = { ...server, ...local };
  const code = errorCode(failedError);
  const stale = code !== undefined && staleCodes.has(code);
  const unexpected =
    failedError != null && !stale && code !== "PRODUCT_ACTIVATION_INVALID" && Object.keys(server).length === 0;
  useFocusFirstError(formRef, editor, errors, attempt);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAttempt((n) => n + 1);
    setNotice(null);
    setIssues(null);
    save.reset();
    const found = localErrors(editor);
    setLocal(found);
    if (Object.keys(found).length > 0) return;
    const steps = savePlan(base, editor);
    if (steps.length === 0) {
      setNotice({ tone: "success", text: "Không có thay đổi nào để lưu." });
      return;
    }
    save.mutate({ from: base, steps, rows: editor.sizes });
  }

  async function reloadLatest() {
    save.reset();
    const fresh = await reload();
    if (!fresh) return;
    // What is typed stays on top of the new version; the next save uses its `If-Match`.
    setEditor((current) => rebase(current, base, fresh));
    setBase(fresh);
  }

  function discard() {
    save.reset();
    setLocal({});
    setNotice(null);
    setEditor(editorOf(product));
    setBase(product);
  }

  /** Adds or removes a new size, then moves the keyboard: to its SKU, or to "Thêm size". */
  function onAdd() {
    const index = editor.sizes.length;
    flushSync(() => setEditor((e) => addSize(e, newKey())));
    const control = formRef.current?.elements.namedItem(`sizes[${index}].sku`);
    if (control instanceof HTMLElement) control.focus();
  }

  function onRemoveNew(key: string) {
    flushSync(() => setEditor((e) => removeNewSize(e, key)));
    addRef.current?.focus();
  }

  const set = (patch: Partial<ProductEditor>) => setEditor((e) => ({ ...e, ...patch }));
  const error = (path: EditorFieldPath) => (errors[path] ? <Field.Error aria-live="polite">{errors[path]}</Field.Error> : null);

  const current = editor.primaryCategoryId ? findCategory(tree ?? [], editor.primaryCategoryId) : undefined;
  const currentArchived = current !== undefined && current.status !== "ACTIVE";
  const active = activeTree(tree ?? []);

  return (
    <Card className="max-w-[860px] gap-6 p-6">
      <form ref={formRef} className="grid gap-6" onSubmit={submit} noValidate>
        {stale ? (
          <div className="grid justify-items-start gap-2">
            <FormAlert tone="warning">
              {code === "CATALOG_PRODUCT_INVALID_TRANSITION"
                ? "Món vừa được lưu trữ nên không sửa được nữa. Tải lại để xem trạng thái mới nhất."
                : "Món vừa được người khác cập nhật. Phần chưa lưu vẫn còn. Tải lại để lấy bản mới rồi lưu lại."}
            </FormAlert>
            <Button variant="outline" density="compact" onClick={() => void reloadLatest()}>
              Tải lại
            </Button>
          </div>
        ) : unexpected ? (
          <FormAlert tone="danger">Chưa lưu được thông tin. Bạn thử lại sau ít phút nhé.</FormAlert>
        ) : null}
        {product.status === "ARCHIVED" ? (
          <p className="text-label font-normal text-ink-muted">Món đã lưu trữ nên không sửa được nữa.</p>
        ) : null}

        <Section title="Thông tin món">
          <Field.Group>
            <Field.Root>
              <Field.Label>Tên món</Field.Label>
              <Field.Input
                name="name"
                autoComplete="off"
                maxLength={NAME_MAX}
                readOnly={readOnly}
                value={editor.name}
                onChange={(e) => set({ name: e.currentTarget.value })}
              />
              {error("name")}
            </Field.Root>
            <Field.Root>
              <Field.Label>Đường dẫn trên menu (slug)</Field.Label>
              <Field.Input
                name="slug"
                autoComplete="off"
                spellCheck={false}
                autoCapitalize="none"
                translate="no"
                maxLength={SLUG_MAX}
                readOnly={readOnly}
                className="font-mono font-semibold tracking-wide"
                value={editor.slug}
                onChange={(e) => set({ slug: e.currentTarget.value })}
              />
              {error("slug")}
              <Field.Hint>Đổi đường dẫn thì link cũ tới trang món không còn dùng được.</Field.Hint>
            </Field.Root>
            <Field.Root>
              <Field.Label>Danh mục chính</Field.Label>
              <Field.Select
                name="primaryCategoryId"
                disabled={readOnly}
                value={editor.primaryCategoryId}
                onChange={(e) => set({ primaryCategoryId: e.currentTarget.value })}
              >
                <option value="">Chưa chọn</option>
                {currentArchived ? <option value={current.categoryId}>{`${current.name} (đã lưu trữ)`}</option> : null}
                {active.flatMap((root) => [
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
              {error("primaryCategoryId") ??
                (currentArchived ? <Field.Hint className="text-danger">Danh mục này đã lưu trữ. Chọn danh mục khác.</Field.Hint> : null)}
            </Field.Root>
            <Field.Root>
              <Field.Label asChild>
                <span>Mã món</span>
              </Field.Label>
              <span translate="no" className="flex h-control-default items-center font-mono text-label font-semibold tracking-wide">
                {product.productCode}
              </span>
              <Field.Hint>Không đổi được sau khi tạo.</Field.Hint>
            </Field.Root>
            <Field.Root span="full">
              <Field.Label>
                Mô tả ngắn <span className="font-normal text-ink-muted">(không bắt buộc)</span>
              </Field.Label>
              <Field.Input
                name="shortDescription"
                autoComplete="off"
                maxLength={SHORT_DESCRIPTION_MAX}
                readOnly={readOnly}
                value={editor.shortDescription}
                onChange={(e) => set({ shortDescription: e.currentTarget.value })}
              />
              {error("shortDescription")}
            </Field.Root>
            <Field.Root span="full">
              <Field.Label>
                Mô tả <span className="font-normal text-ink-muted">(không bắt buộc)</span>
              </Field.Label>
              <Field.Textarea
                name="description"
                rows={4}
                maxLength={DESCRIPTION_MAX}
                readOnly={readOnly}
                value={editor.description}
                onChange={(e) => set({ description: e.currentTarget.value })}
              />
              {error("description")}
            </Field.Root>
          </Field.Group>
        </Section>

        <Section title="Size và giá gốc" headingId="product-sizes" className="border-t border-line pt-5">
          {errors.sizes ? <FormAlert tone="danger">{errors.sizes}</FormAlert> : null}
          <div className="overflow-x-auto">
            <div className="grid min-w-max gap-2.5">
              <div aria-hidden="true" className={`${rowColumns} text-caption font-semibold tracking-wide text-ink-muted uppercase`}>
                <span>Mã SKU</span>
                <span>Tên size</span>
                <span>Giá gốc</span>
                <span>Mặc định</span>
                <span>Trạng thái</span>
                <span className="text-right">Thao tác</span>
              </div>
              {editor.sizes.map((size, i) => (
                <SizeLine
                  key={size.key}
                  index={i}
                  size={size}
                  isDefault={size.key === editor.defaultKey}
                  readOnly={readOnly}
                  priceReadOnly={readOnly || !canPrice}
                  error={error}
                  onChange={(change) => setEditor((e) => setSize(e, size.key, change))}
                  onDefault={() => set({ defaultKey: size.key })}
                  onArchive={() => setArchiving(size)}
                  onRemove={() => onRemoveNew(size.key)}
                />
              ))}
            </div>
          </div>
          {readOnly || !canPrice ? null : editor.sizes.length < VARIANT_MAX ? (
            <Button ref={addRef} variant="ghost" density="compact" className="justify-self-start" onClick={onAdd}>
              <span aria-hidden="true">+ </span>Thêm size
            </Button>
          ) : (
            <p className="text-caption text-ink-muted">Một món có tối đa {VARIANT_MAX} size.</p>
          )}
          <p className="text-caption text-ink-muted">
            {canPrice
              ? "Giá gốc áp cho mọi chi nhánh, trừ khi chi nhánh đặt giá riêng."
              : "Bạn không có quyền quản lý giá nên giá gốc chỉ xem được và không thêm size được."}
          </p>
        </Section>

        {readOnly ? null : (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line pt-5">
            <Button variant="ghost" onClick={discard}>
              Bỏ thay đổi
            </Button>
            <Button type="submit" busy={save.isPending}>
              Lưu thông tin
            </Button>
          </div>
        )}
      </form>

      <ArchiveSizeDialog
        product={base}
        size={archiving}
        onClose={() => setArchiving(null)}
        onArchived={(before, next) => {
          setArchiving(null);
          accept(before, next);
          setNotice({ tone: "success", text: "Đã lưu trữ size." });
        }}
        onIssues={(issues) => {
          setArchiving(null);
          setIssues(issues);
        }}
      />
    </Card>
  );
}

interface SizeLineProps {
  index: number;
  size: SizeRow;
  isDefault: boolean;
  readOnly: boolean;
  priceReadOnly: boolean;
  error: (path: EditorFieldPath) => ReactNode;
  onChange: (change: Partial<Pick<SizeRow, "sku" | "name" | "price">>) => void;
  onDefault: () => void;
  onArchive: () => void;
  onRemove: () => void;
}

function SizeLine({ index, size, isDefault, readOnly, priceReadOnly, error, onChange, onDefault, onArchive, onRemove }: SizeLineProps) {
  const n = index + 1;
  const label = size.name.trim() || `${n}`;
  const path = (field: "sku" | "name" | "basePrice") => `sizes[${index}].${field}` as const;
  const saved = size.variantId !== null;
  return (
    <div role="group" aria-label={`Size ${label}`} className={rowColumns}>
      {saved ? (
        <span translate="no" className="flex h-10 items-center font-mono text-label font-semibold tracking-wide">
          {size.sku}
        </span>
      ) : (
        <Field.Root className="gap-1">
          <Field.Label className="sr-only">{`Mã SKU size ${n}`}</Field.Label>
          <Field.Input
            name={path("sku")}
            autoComplete="off"
            spellCheck={false}
            autoCapitalize="characters"
            translate="no"
            maxLength={CODE_MAX}
            className="font-mono font-semibold tracking-wide uppercase"
            value={size.sku}
            onChange={(e) => onChange({ sku: e.currentTarget.value })}
          />
          {error(path("sku"))}
        </Field.Root>
      )}
      <Field.Root className="gap-1">
        <Field.Label className="sr-only">{`Tên size ${n}`}</Field.Label>
        <Field.Input
          name={path("name")}
          autoComplete="off"
          maxLength={VARIANT_NAME_MAX}
          readOnly={readOnly}
          value={size.name}
          onChange={(e) => onChange({ name: e.currentTarget.value })}
        />
        {error(path("name"))}
      </Field.Root>
      <Field.Root className="gap-1">
        <Field.Label className="sr-only">{`Giá gốc size ${label} (đồng)`}</Field.Label>
        <Field.Input
          name={path("basePrice")}
          inputMode="numeric"
          autoComplete="off"
          readOnly={priceReadOnly}
          className="tabular-nums"
          value={size.price}
          onChange={(e) => onChange({ price: e.currentTarget.value })}
          onBlur={(e) => {
            const amount = parsePrice(e.currentTarget.value);
            if (amount !== null) onChange({ price: formatVnd(amount) });
          }}
        />
        {error(path("basePrice"))}
      </Field.Root>
      <label className="flex h-10 cursor-pointer items-center gap-2 text-body font-medium has-disabled:cursor-default">
        <input
          type="radio"
          name="defaultSize"
          checked={isDefault}
          disabled={readOnly}
          onChange={onDefault}
          className="size-4.5 accent-matcha-700"
        />
        Mặc định
      </label>
      <span className="flex h-10 items-center">
        {saved ? (
          <StatusBadge tone={sizeStatus[size.status].tone} dot>
            {sizeStatus[size.status].label}
          </StatusBadge>
        ) : (
          <StatusBadge tone="neutral">Chưa lưu</StatusBadge>
        )}
      </span>
      <span className="flex h-10 items-center justify-end">
        {readOnly ? null : saved ? (
          <Button variant="ghost" density="compact" onClick={onArchive}>
            Lưu trữ size…
          </Button>
        ) : (
          <Button variant="ghost" density="compact" onClick={onRemove}>
            Bỏ size
          </Button>
        )}
      </span>
    </div>
  );
}

interface ArchiveSizeDialogProps {
  product: Product;
  size: SizeRow | null;
  onClose: () => void;
  onArchived: (before: Product, next: Product) => void;
  onIssues: (issues: NonNullable<ReturnType<typeof activationIssues>>) => void;
}

/** Archiving a size is final (API 08 §1.7): confirm first. */
function ArchiveSizeDialog({ product, size, onClose, onArchived, onIssues }: ArchiveSizeDialogProps) {
  const api = useApi();
  const archive = useMutation({
    mutationFn: (variantId: string) => archiveVariant(api, product, variantId),
    onSuccess: (next) => onArchived(product, next),
    onError: (error) => {
      const issues = activationIssues(error);
      if (issues) onIssues(issues);
    },
  });
  const code = errorCode(archive.error);
  const message =
    code === "CATALOG_VARIANT_IS_DEFAULT"
      ? "Đây là size mặc định. Chọn size khác làm mặc định, bấm Lưu thông tin, rồi lưu trữ size này."
      : code === "VERSION_CONFLICT" || code === "CATALOG_VARIANT_ARCHIVED"
        ? "Món vừa được người khác cập nhật. Đóng hộp này, bấm Tải lại rồi thử lại."
        : archive.isError
          ? "Chưa lưu trữ được size. Bạn thử lại sau ít phút nhé."
          : null;

  return (
    <Dialog.Root
      open={size !== null}
      onOpenChange={(open) => {
        if (!open) {
          archive.reset();
          onClose();
        }
      }}
    >
      {size ? (
        <Dialog.Content className="w-[min(calc(100%-32px),440px)] p-6">
          <Dialog.Title>{`Lưu trữ size ${size.name}?`}</Dialog.Title>
          <Dialog.Description className="text-ink">
            Lưu trữ là vĩnh viễn: size không bán lại được và không hiện cho khách nữa. Đơn cũ vẫn giữ size này.
          </Dialog.Description>
          {message ? <FormAlert tone="danger">{message}</FormAlert> : null}
          <Dialog.Actions>
            <Dialog.Close asChild>
              <Button variant="ghost">Huỷ</Button>
            </Dialog.Close>
            <Button variant="danger" busy={archive.isPending} onClick={() => archive.mutate(size.variantId!)}>
              Lưu trữ size
            </Button>
          </Dialog.Actions>
        </Dialog.Content>
      ) : null}
    </Dialog.Root>
  );
}

/**
 * After a failed save, put the keyboard on the first field (in form order) that has an error; an
 * error of the whole size section goes to its heading. `attempt` counts submits.
 */
function useFocusFirstError(form: RefObject<HTMLFormElement | null>, editor: ProductEditor, errors: EditorFieldErrors, attempt: number) {
  const first = fieldOrder(editor).find((path) => errors[path]);
  useEffect(() => {
    if (!first) return;
    if (first === "sizes") {
      document.getElementById("product-sizes")?.focus();
      return;
    }
    const control = form.current?.elements.namedItem(first);
    if (control instanceof HTMLElement) control.focus();
  }, [form, first, attempt]);
}
