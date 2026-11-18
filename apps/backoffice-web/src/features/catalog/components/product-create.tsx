import { formatVnd } from "@hayi/domain-utils";
import { Button, Card, Field } from "@hayi/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { type FormEvent, type ReactNode, type RefObject, useEffect, useRef, useState } from "react";
import { useApi } from "../../../lib/api";
import { FormAlert } from "../../../lib/form-alert";
import { createProduct, productKeys } from "../api/products";
import { activeTree, slugify } from "../category-form";
import { useCategoryTree } from "../hooks/use-categories";
import {
  CODE_MAX,
  NAME_MAX,
  type ProductDraft,
  type ProductFieldErrors,
  type ProductFieldPath,
  SHORT_DESCRIPTION_MAX,
  SLUG_MAX,
  VARIANT_MAX,
  VARIANT_NAME_MAX,
  type VariantRow,
  addVariant,
  createBody,
  emptyDraft,
  fieldOrder,
  localErrors,
  parsePrice,
  removeVariant,
  serverErrors,
} from "../product-form";
import { ProductBreadcrumb } from "./product-breadcrumb";

let nextKey = 0;
const newKey = () => `size-${++nextKey}`;

/** Columns of a size row (screen 22): SKU · name · base price · default · remove. */
const rowColumns = "grid grid-cols-[200px_120px_140px_110px_36px] items-start gap-2.5";

/** D3d screen 22: a DRAFT Product with its sizes and base prices; then its page opens. */
export function ProductCreate() {
  const api = useApi();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: tree } = useCategoryTree(false);
  const formRef = useRef<HTMLFormElement>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  const [draft, setDraft] = useState<ProductDraft>(() => emptyDraft(newKey));
  const [local, setLocal] = useState<ProductFieldErrors>({});
  const [attempt, setAttempt] = useState(0);
  // The slug follows the name until the user types a slug of their own.
  const [slugTouched, setSlugTouched] = useState(false);
  // Where the keyboard goes after a size is added or removed.
  const [focusAfter, setFocusAfter] = useState<{ path: string } | "add" | null>(null);

  const create = useMutation({
    mutationFn: (body: Parameters<typeof createProduct>[1]) => createProduct(api, body),
    onSuccess: (product) => {
      queryClient.setQueryData(productKeys.detail(product.productId), product);
      void queryClient.invalidateQueries({ queryKey: [...productKeys.all, "list"] });
      void navigate({ to: "/admin/products/$id", params: { id: product.productId }, search: { created: 1 } });
    },
  });

  const server = serverErrors(create.error, draft);
  const errors: ProductFieldErrors = { ...server, ...local };
  const unexpected = create.isError && Object.keys(server).length === 0;
  useFocusFirstError(formRef, draft, errors, attempt);

  useEffect(() => {
    if (focusAfter === null) return;
    if (focusAfter === "add") addRef.current?.focus();
    else {
      const control = formRef.current?.elements.namedItem(focusAfter.path);
      if (control instanceof HTMLElement) control.focus();
    }
    setFocusAfter(null);
  }, [focusAfter]);

  const set = (patch: Partial<ProductDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const setVariant = (key: string, patch: Partial<VariantRow>) =>
    setDraft((d) => ({ ...d, variants: d.variants.map((v) => (v.key === key ? { ...v, ...patch } : v)) }));

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAttempt((n) => n + 1);
    // Errors of the previous answer no longer describe what is in the form.
    create.reset();
    const found = localErrors(draft);
    setLocal(found);
    if (Object.keys(found).length > 0) return;
    create.mutate(createBody(draft));
  }

  const error = (path: ProductFieldPath) => (errors[path] ? <Field.Error aria-live="polite">{errors[path]}</Field.Error> : null);

  return (
    <>
      <ProductBreadcrumb current="Tạo món" />
      <h1 className="font-display text-heading-lg">Tạo món</h1>

      <Card className="max-w-[860px] gap-6 p-6">
        <form ref={formRef} className="grid gap-6" onSubmit={submit} noValidate>
          {unexpected ? <FormAlert tone="danger">Chưa tạo được món. Bạn thử lại sau ít phút nhé.</FormAlert> : null}

          <Section title="Thông tin món">
            <Field.Group>
              <Field.Root>
                <Field.Label>Tên món</Field.Label>
                <Field.Input
                  name="name"
                  autoComplete="off"
                  maxLength={NAME_MAX}
                  value={draft.name}
                  onChange={(e) => {
                    const name = e.currentTarget.value;
                    set(slugTouched ? { name } : { name, slug: slugify(name, SLUG_MAX) });
                  }}
                />
                {error("name")}
              </Field.Root>
              <Field.Root>
                <Field.Label>Mã món</Field.Label>
                <Field.Input
                  name="productCode"
                  autoComplete="off"
                  spellCheck={false}
                  autoCapitalize="characters"
                  translate="no"
                  maxLength={CODE_MAX}
                  className="font-mono font-semibold tracking-wide uppercase"
                  value={draft.productCode}
                  onChange={(e) => set({ productCode: e.currentTarget.value })}
                />
                {error("productCode")}
                <Field.Hint>Chữ in hoa, số, dấu gạch ngang. Không đổi được sau khi tạo.</Field.Hint>
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
                  className="font-mono font-semibold tracking-wide"
                  value={draft.slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    set({ slug: e.currentTarget.value });
                  }}
                />
                {error("slug")}
                <Field.Hint>Tự tạo từ tên; khách thấy trong địa chỉ trang món.</Field.Hint>
              </Field.Root>
              <Field.Root>
                <Field.Label>Danh mục chính</Field.Label>
                <Field.Select
                  name="primaryCategoryId"
                  value={draft.primaryCategoryId}
                  onChange={(e) => set({ primaryCategoryId: e.currentTarget.value })}
                >
                  <option value="">Chọn danh mục…</option>
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
                {error("primaryCategoryId")}
                <Field.Hint>Cần có trước khi kích hoạt món.</Field.Hint>
              </Field.Root>
              <Field.Root span="full">
                <Field.Label>
                  Mô tả ngắn <span className="font-normal text-ink-muted">(không bắt buộc)</span>
                </Field.Label>
                <Field.Input
                  name="shortDescription"
                  autoComplete="off"
                  maxLength={SHORT_DESCRIPTION_MAX}
                  placeholder="Ví dụ: Matcha Uji xay đá, phủ kem muối béo nhẹ…"
                  value={draft.shortDescription}
                  onChange={(e) => set({ shortDescription: e.currentTarget.value })}
                />
                {error("shortDescription")}
              </Field.Root>
            </Field.Group>
          </Section>

          <Section
            title="Size và giá gốc"
            note="Món chỉ có một loại: để một size tên “Standard”."
            className="border-t border-line pt-5"
          >
            {errors.variants ? <FormAlert tone="danger">{errors.variants}</FormAlert> : null}
            <div className="overflow-x-auto">
              <div className="grid min-w-max gap-2.5">
                <div
                  aria-hidden="true"
                  className={`${rowColumns} text-caption font-semibold tracking-wide text-ink-muted uppercase`}
                >
                  <span>Mã SKU</span>
                  <span>Tên size</span>
                  <span>Giá gốc</span>
                  <span>Mặc định</span>
                  <span />
                </div>
                {draft.variants.map((variant, i) => (
                  <SizeRow
                    key={variant.key}
                    index={i}
                    variant={variant}
                    isDefault={variant.key === draft.defaultKey}
                    removable={draft.variants.length > 1}
                    error={error}
                    onChange={(patch) => setVariant(variant.key, patch)}
                    onDefault={() => set({ defaultKey: variant.key })}
                    onRemove={() => {
                      setDraft((d) => removeVariant(d, variant.key));
                      setFocusAfter("add");
                    }}
                  />
                ))}
              </div>
            </div>
            {draft.variants.length < VARIANT_MAX ? (
              <Button
                ref={addRef}
                variant="ghost"
                density="compact"
                className="justify-self-start"
                onClick={() => {
                  setDraft((d) => addVariant(d, newKey()));
                  setFocusAfter({ path: `variants[${draft.variants.length}].sku` });
                }}
              >
                <span aria-hidden="true">+ </span>Thêm size
              </Button>
            ) : (
              <p className="text-caption text-ink-muted">Một món có tối đa {VARIANT_MAX} size.</p>
            )}
            <p className="text-caption text-ink-muted">
              Giá gốc áp cho mọi chi nhánh, trừ khi chi nhánh đặt giá riêng. Cần quyền quản lý giá.
            </p>
          </Section>

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line pt-5">
            <span className="mr-auto text-label font-normal text-ink-muted">
              Món mới ở trạng thái Nháp. Khách chưa thấy cho đến khi bạn kích hoạt và chi nhánh bật bán.
            </span>
            <Button asChild variant="ghost" className="no-underline">
              <Link to="/admin/products">Huỷ</Link>
            </Button>
            <Button type="submit" busy={create.isPending}>
              Tạo món
            </Button>
          </div>
        </form>
      </Card>
    </>
  );
}

function Section({ title, note, className, children }: { title: string; note?: string; className?: string; children: ReactNode }) {
  return (
    <section aria-label={title} className={`grid gap-3.5 ${className ?? ""}`}>
      <div className="flex flex-wrap items-baseline gap-2.5">
        <h2 className="text-title">{title}</h2>
        {note ? <span className="text-label font-normal text-ink-muted">{note}</span> : null}
      </div>
      {children}
    </section>
  );
}

interface SizeRowProps {
  index: number;
  variant: VariantRow;
  isDefault: boolean;
  removable: boolean;
  error: (path: ProductFieldPath) => ReactNode;
  onChange: (patch: Partial<VariantRow>) => void;
  onDefault: () => void;
  onRemove: () => void;
}

function SizeRow({ index, variant, isDefault, removable, error, onChange, onDefault, onRemove }: SizeRowProps) {
  const n = index + 1;
  const path = (field: "sku" | "name" | "basePrice") => `variants[${index}].${field}` as const;
  return (
    <div role="group" aria-label={`Size ${n}`} className={rowColumns}>
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
          value={variant.sku}
          onChange={(e) => onChange({ sku: e.currentTarget.value })}
        />
        {error(path("sku"))}
      </Field.Root>
      <Field.Root className="gap-1">
        <Field.Label className="sr-only">{`Tên size ${n}`}</Field.Label>
        <Field.Input
          name={path("name")}
          autoComplete="off"
          maxLength={VARIANT_NAME_MAX}
          value={variant.name}
          onChange={(e) => onChange({ name: e.currentTarget.value })}
        />
        {error(path("name"))}
      </Field.Root>
      <Field.Root className="gap-1">
        <Field.Label className="sr-only">{`Giá gốc size ${n} (đồng)`}</Field.Label>
        <Field.Input
          name={path("basePrice")}
          inputMode="numeric"
          autoComplete="off"
          className="tabular-nums"
          value={variant.price}
          onChange={(e) => onChange({ price: e.currentTarget.value })}
          onBlur={(e) => {
            const amount = parsePrice(e.currentTarget.value);
            if (amount !== null) onChange({ price: formatVnd(amount) });
          }}
        />
        {error(path("basePrice"))}
      </Field.Root>
      <label className="flex h-10 cursor-pointer items-center gap-2 text-body font-medium">
        <input
          type="radio"
          name="defaultVariant"
          checked={isDefault}
          onChange={onDefault}
          className="size-4.5 accent-matcha-700"
        />
        Mặc định
      </label>
      <Button
        variant="ghost"
        density="compact"
        aria-label={`Xoá size ${n}`}
        aria-disabled={!removable || undefined}
        className="w-9 px-0"
        onClick={() => removable && onRemove()}
      >
        <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="m5 5 10 10M15 5 5 15" />
        </svg>
      </Button>
    </div>
  );
}

/**
 * After a failed submit, put the keyboard on the first field (in form order) that has an error;
 * an error of the whole size section goes to the first SKU. `attempt` counts submits.
 */
function useFocusFirstError(
  form: RefObject<HTMLFormElement | null>,
  draft: ProductDraft,
  errors: ProductFieldErrors,
  attempt: number,
) {
  const first = fieldOrder(draft).find((path) => errors[path]);
  const target = first === "variants" ? "variants[0].sku" : first;
  useEffect(() => {
    if (!target) return;
    const control = form.current?.elements.namedItem(target);
    if (control instanceof HTMLElement) control.focus();
  }, [form, target, attempt]);
}
