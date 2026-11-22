import { Button, Card, Dialog, Field, Skeleton, StatusBadge, Table, cn, focusRing } from "@hayi/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useId, useState } from "react";
import { flushSync } from "react-dom";
import { useApi } from "../../../lib/api";
import { FormAlert } from "../../../lib/form-alert";
import { useWorkspace } from "../../../lib/workspace";
import {
  type Collection,
  type Tag,
  allProductsQuery,
  archiveCollection,
  collectionKeys,
  collectionsQuery,
  createCollection,
  createTag,
  replaceCollectionProducts,
  tagKeys,
  tagsQuery,
  updateCollection,
  updateTag,
} from "../api/collections";
import type { ProductSummary } from "../api/products";
import { slugify } from "../category-form";
import {
  COLLECTION_TEXT_MAX,
  type CollectionDraft,
  type CollectionErrors,
  TAG_TEXT_MAX,
  addProduct,
  collectionChanges,
  collectionErrorText,
  draftOfCollection,
  moveProduct,
  removeProduct,
  swapCollections,
  textErrors,
} from "../collection-editor";
import { productStatusLabel, productStatusTone } from "../product-status";

type Notice = { tone: "success" | "danger" | "warning"; text: string; reload?: boolean } | null;

interface CollectionsScreenProps {
  /** From the URL: a collection id, `"new"`, or nothing (the first one). */
  selected: string | undefined;
  onSelect: (selected: string | undefined) => void;
}

/** D3d screen 28: collections (products grouped by theme, besides the primary category) and tags (Decision AL). */
export function CollectionsScreen({ selected, onSelect }: CollectionsScreenProps) {
  const api = useApi();
  const queryClient = useQueryClient();
  const { permissions } = useWorkspace();
  // UX only: the API answers 403 (Decision M4).
  const canManage = permissions.has("CATALOG_MANAGE");
  const collections = useQuery(collectionsQuery(api));
  const [notice, setNotice] = useState<Notice>(null);

  const list = collections.data ?? [];
  const creating = selected === "new" && canManage;
  const current = creating ? null : (list.find((c) => c.collectionId === selected) ?? list[0] ?? null);

  async function move(collectionId: string, by: -1 | 1) {
    const swap = swapCollections(list, collectionId, by);
    if (!swap) return;
    setNotice(null);
    try {
      for (const { collection, sortOrder } of swap) await updateCollection(api, collection, { sortOrder });
    } catch (error) {
      setNotice({ tone: "warning", ...collectionErrorText(error) });
    }
    await queryClient.invalidateQueries({ queryKey: collectionKeys.all });
    document.getElementById(`collection-${collectionId}-${by < 0 ? "up" : "down"}`)?.focus();
  }

  return (
    <>
      <div className="grid gap-1">
        <h1 className="font-display text-heading-lg text-balance">Bộ sưu tập &amp; tag</h1>
        <p className="text-label font-normal text-ink-muted">Nhóm món theo chủ đề, ngoài danh mục chính</p>
      </div>
      {notice ? (
        <div className="grid justify-items-start gap-2">
          <FormAlert tone={notice.tone}>{notice.text}</FormAlert>
          {notice.reload ? (
            <Button variant="outline" density="compact" onClick={() => void collections.refetch().then(() => setNotice(null))}>
              Tải lại
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className="grid items-start gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <Card role="region" aria-label="Bộ sưu tập" className="gap-2 p-3">
          <div className="flex items-center gap-2 px-1">
            <h2 className="text-title">Bộ sưu tập</h2>
            {canManage ? (
              <Button variant="ghost" density="compact" className="ml-auto" onClick={() => onSelect("new")}>
                + Tạo
              </Button>
            ) : null}
          </div>
          {!collections.data ? (
            collections.isError ? (
              <FormAlert tone="danger">Chưa tải được bộ sưu tập. Kiểm tra mạng rồi thử lại.</FormAlert>
            ) : (
              <Skeleton className="h-32 w-full" />
            )
          ) : list.length === 0 ? (
            <p className="px-1 text-body text-ink-muted">Chưa có bộ sưu tập nào.</p>
          ) : (
            <ul className="grid gap-1">
              {list.map((c, i) => (
                <li key={c.collectionId} className="flex items-center gap-1">
                  {canManage ? (
                    <span className="flex flex-col">
                      <MoveButton id={`collection-${c.collectionId}-up`} label={`Chuyển ${c.name} lên`} disabled={i === 0} onClick={() => void move(c.collectionId, -1)} up />
                      <MoveButton id={`collection-${c.collectionId}-down`} label={`Chuyển ${c.name} xuống`} disabled={i === list.length - 1} onClick={() => void move(c.collectionId, 1)} />
                    </span>
                  ) : null}
                  <button
                    type="button"
                    aria-current={c.collectionId === current?.collectionId ? "true" : undefined}
                    onClick={() => onSelect(c.collectionId)}
                    className={cn(
                      "flex min-h-13 flex-1 items-center gap-2 rounded-md px-3 py-2 text-left hover:bg-sunken aria-[current=true]:bg-matcha-100",
                      focusRing,
                    )}
                  >
                    <span className="min-w-0 flex-1 font-medium break-words">{c.name}</span>
                    <span className="text-caption text-ink-muted tabular-nums">{`${c.productIds.length} món`}</span>
                    {c.status === "INACTIVE" ? <StatusBadge tone="neutral">Đang ẩn</StatusBadge> : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="grid gap-4">
          {creating ? (
            <NewCollection onCreated={(c) => onSelect(c.collectionId)} onCancel={() => onSelect(undefined)} />
          ) : current ? (
            <CollectionEditor key={current.collectionId} latest={current} canManage={canManage} onArchived={() => onSelect(undefined)} />
          ) : null}
          <TagsCard canManage={canManage} />
        </div>
      </div>
    </>
  );
}

function MoveButton({ id, label, disabled, onClick, up }: { id: string; label: string; disabled: boolean; onClick: () => void; up?: boolean }) {
  return (
    <Button
      id={id}
      variant="ghost"
      density="compact"
      aria-label={label}
      aria-disabled={disabled || undefined}
      className="h-5 w-7 px-0"
      onClick={() => !disabled && onClick()}
    >
      <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d={up ? "m5 12 5-5 5 5" : "m5 8 5 5 5-5"} />
      </svg>
    </Button>
  );
}

/** "+ Tạo": name and slug (the slug follows the name until typed), then the new collection opens. */
function NewCollection({ onCreated, onCancel }: { onCreated: (c: Collection) => void; onCancel: () => void }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const titleId = useId();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [errors, setErrors] = useState<CollectionErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found = textErrors(name, slug, COLLECTION_TEXT_MAX);
    setErrors(found);
    setMessage(null);
    if (Object.keys(found).length > 0) return;
    setBusy(true);
    try {
      const created = await createCollection(api, { name: name.trim(), slug: slug.trim() });
      await queryClient.invalidateQueries({ queryKey: collectionKeys.all });
      onCreated(created);
    } catch (error) {
      const failure = collectionErrorText(error);
      if (failure.field) setErrors({ slug: failure.text });
      else setMessage(failure.text);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="gap-4 p-5">
      <form aria-labelledby={titleId} className="grid gap-4" onSubmit={(e) => void submit(e)} noValidate>
        <h2 id={titleId} className="text-title">
          Tạo bộ sưu tập
        </h2>
        {message ? <FormAlert tone="danger">{message}</FormAlert> : null}
        <NameSlugFields
          name={name}
          slug={slug}
          errors={errors}
          max={COLLECTION_TEXT_MAX}
          onName={(v) => {
            setName(v);
            if (!slugTouched) setSlug(slugify(v, COLLECTION_TEXT_MAX));
          }}
          onSlug={(v) => {
            setSlugTouched(true);
            setSlug(v);
          }}
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            Huỷ
          </Button>
          <Button type="submit" busy={busy}>
            Tạo bộ sưu tập
          </Button>
        </div>
      </form>
    </Card>
  );
}

function NameSlugFields(props: {
  name: string;
  slug: string;
  errors: CollectionErrors;
  max: number;
  readOnly?: boolean;
  onName: (value: string) => void;
  onSlug: (value: string) => void;
}) {
  return (
    <Field.Group>
      <Field.Root>
        <Field.Label>Tên (khách thấy)</Field.Label>
        <Field.Input name="name" autoComplete="off" maxLength={props.max} readOnly={props.readOnly} value={props.name} onChange={(e) => props.onName(e.currentTarget.value)} />
        {props.errors.name ? <Field.Error aria-live="polite">{props.errors.name}</Field.Error> : null}
      </Field.Root>
      <Field.Root>
        <Field.Label>Đường dẫn (slug)</Field.Label>
        <Field.Input
          name="slug"
          autoComplete="off"
          spellCheck={false}
          autoCapitalize="none"
          translate="no"
          maxLength={props.max}
          readOnly={props.readOnly}
          className="font-mono font-semibold tracking-wide"
          value={props.slug}
          onChange={(e) => props.onSlug(e.currentTarget.value)}
        />
        {props.errors.slug ? <Field.Error aria-live="polite">{props.errors.slug}</Field.Error> : null}
      </Field.Root>
    </Field.Group>
  );
}

/** One collection: name, slug, its products in order (customers see this order), save and archive. */
function CollectionEditor({ latest, canManage, onArchived }: { latest: Collection; canManage: boolean; onArchived: () => void }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const titleId = useId();
  const products = useQuery(allProductsQuery(api));
  // The version the draft was made from (the #35 pattern): a newer one replaces an untouched draft, or any draft
  // after "Tải lại"; over typed edits the save answers 412 instead.
  const [collection, setCollection] = useState<Collection>(latest);
  const [draft, setDraft] = useState<CollectionDraft>(() => draftOfCollection(latest));
  const [rebasing, setRebasing] = useState(false);
  const [errors, setErrors] = useState<CollectionErrors>({});
  const [notice, setNotice] = useState<Notice>(null);
  if (latest.version !== collection.version && (rebasing || JSON.stringify(draft) === JSON.stringify(draftOfCollection(collection)))) {
    setCollection(latest);
    setDraft(draftOfCollection(latest));
    if (rebasing) {
      setRebasing(false);
      setNotice(null);
    }
  }
  const [busy, setBusy] = useState(false);
  const [toAdd, setToAdd] = useState("");
  const [archiving, setArchiving] = useState(false);
  const byId = new Map((products.data ?? []).map((p) => [p.productId, p]));
  const addable = (products.data ?? []).filter((p) => !draft.productIds.includes(p.productId)).sort((a, b) => a.name.localeCompare(b.name, "vi"));

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    const found = textErrors(draft.name, draft.slug, COLLECTION_TEXT_MAX);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const { patch, productIds } = collectionChanges(collection, draft);
    if (!patch && !productIds) {
      setNotice({ tone: "success", text: "Không có thay đổi nào để lưu." });
      return;
    }
    setBusy(true);
    try {
      // Each answer carries the next version for the following request's If-Match.
      const patched = patch ? await updateCollection(api, collection, patch) : collection;
      const saved = productIds ? await replaceCollectionProducts(api, patched, productIds) : patched;
      setCollection(saved);
      setDraft(draftOfCollection(saved));
      await queryClient.invalidateQueries({ queryKey: collectionKeys.all });
      setNotice({ tone: "success", text: "Đã lưu bộ sưu tập. Khách thấy thay đổi trên menu sau khoảng một phút." });
    } catch (error) {
      const failure = collectionErrorText(error);
      if (failure.field) setErrors({ slug: failure.text });
      else setNotice({ tone: "warning", text: failure.text, ...(failure.reload && { reload: true }) });
    } finally {
      setBusy(false);
    }
  }

  function add() {
    if (!toAdd) return;
    flushSync(() => {
      setDraft((d) => addProduct(d, toAdd));
      setToAdd("");
    });
  }

  return (
    <Card role="region" aria-labelledby={titleId} className="gap-4 p-5">
      <form className="grid gap-4" onSubmit={(e) => void save(e)} noValidate>
        <div className="flex items-center gap-2">
          <h2 id={titleId} className="text-title break-words">
            {collection.name}
          </h2>
          {canManage ? (
            <Button variant="ghost" density="compact" className="ml-auto" onClick={() => setArchiving(true)}>
              Lưu trữ…
            </Button>
          ) : null}
        </div>
        {notice ? (
          <div className="grid justify-items-start gap-2">
            <FormAlert tone={notice.tone}>{notice.text}</FormAlert>
            {notice.reload ? (
              <Button
                variant="outline"
                density="compact"
                onClick={() => {
                  setRebasing(true);
                  void queryClient.invalidateQueries({ queryKey: collectionKeys.all });
                }}
              >
                Tải lại
              </Button>
            ) : null}
          </div>
        ) : null}
        <NameSlugFields
          name={draft.name}
          slug={draft.slug}
          errors={errors}
          max={COLLECTION_TEXT_MAX}
          readOnly={!canManage}
          onName={(name) => setDraft((d) => ({ ...d, name }))}
          onSlug={(slug) => setDraft((d) => ({ ...d, slug }))}
        />

        {draft.productIds.length === 0 ? (
          <p className="text-body text-ink-muted">Bộ sưu tập chưa có món nào.</p>
        ) : (
          <ol aria-label="Món trong bộ sưu tập, theo thứ tự hiển thị" className="grid">
            {draft.productIds.map((productId, i) => {
              const product: ProductSummary | undefined = byId.get(productId);
              const name = product?.name ?? "Món không còn";
              return (
                <li key={productId} className="grid min-h-12 grid-cols-[28px_32px_minmax(0,1fr)_auto_auto] items-center gap-2.5 border-b border-line px-2">
                  <span className="text-right text-caption font-semibold text-ink-muted tabular-nums">{i + 1}</span>
                  {canManage ? (
                    <span className="flex flex-col">
                      <MoveButton id={`item-${productId}-up`} label={`Chuyển ${name} lên`} disabled={i === 0} onClick={() => setDraft((d) => moveProduct(d, productId, -1))} up />
                      <MoveButton id={`item-${productId}-down`} label={`Chuyển ${name} xuống`} disabled={i === draft.productIds.length - 1} onClick={() => setDraft((d) => moveProduct(d, productId, 1))} />
                    </span>
                  ) : (
                    <span />
                  )}
                  <span className="min-w-0 font-medium break-words">{name}</span>
                  {product ? (
                    <StatusBadge tone={productStatusTone[product.status]} dot>
                      {productStatusLabel[product.status]}
                    </StatusBadge>
                  ) : (
                    <span />
                  )}
                  {canManage ? (
                    <Button variant="ghost" density="compact" aria-label={`Bỏ ${name} khỏi bộ sưu tập`} onClick={() => setDraft((d) => removeProduct(d, productId))}>
                      Bỏ
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ol>
        )}

        {canManage ? (
          <div className="flex flex-wrap items-end gap-2">
            <Field.Root className="min-w-[260px] flex-1">
              <Field.Label>Thêm món vào bộ sưu tập</Field.Label>
              <Field.Select value={toAdd} onChange={(e) => setToAdd(e.currentTarget.value)}>
                <option value="">{products.isPending ? "Đang tải món…" : "Chọn món…"}</option>
                {addable.map((p) => (
                  <option key={p.productId} value={p.productId}>
                    {`${p.name} · ${p.productCode}`}
                  </option>
                ))}
              </Field.Select>
            </Field.Root>
            <Button variant="outline" density="compact" aria-disabled={!toAdd || undefined} onClick={add}>
              Thêm
            </Button>
          </div>
        ) : null}
        <p className="text-caption text-ink-muted">
          Khách chỉ thấy món đang bán và được chi nhánh bật bán. Một món có thể nằm trong nhiều bộ sưu tập.
        </p>
        {canManage ? (
          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <Button
              variant="ghost"
              onClick={() => {
                setCollection(latest);
                setDraft(draftOfCollection(latest));
                setErrors({});
                setNotice(null);
              }}
            >
              Bỏ thay đổi
            </Button>
            <Button type="submit" busy={busy}>
              Lưu bộ sưu tập
            </Button>
          </div>
        ) : null}
      </form>

      <Dialog.Root open={archiving} onOpenChange={setArchiving}>
        {archiving ? (
          <Dialog.Content className="w-[min(calc(100%-32px),440px)] p-6">
            <Dialog.Title>{`Lưu trữ ${collection.name}?`}</Dialog.Title>
            <Dialog.Description className="text-ink">Bộ sưu tập không còn hiện trên menu. Lưu trữ là vĩnh viễn; các món vẫn giữ nguyên.</Dialog.Description>
            <Dialog.Actions>
              <Dialog.Close asChild>
                <Button variant="ghost">Huỷ</Button>
              </Dialog.Close>
              <Button
                variant="danger"
                onClick={() => {
                  setArchiving(false);
                  void archiveCollection(api, collection)
                    .then(() => queryClient.invalidateQueries({ queryKey: collectionKeys.all }))
                    .then(onArchived)
                    .catch((error: unknown) => setNotice({ tone: "warning", ...collectionErrorText(error) }));
                }}
              >
                Lưu trữ
              </Button>
            </Dialog.Actions>
          </Dialog.Content>
        ) : null}
      </Dialog.Root>
    </Card>
  );
}

/** Tags: name and slug, created and renamed here; attached to a product on its tab "Lịch bán & tag". */
function TagsCard({ canManage }: { canManage: boolean }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const titleId = useId();
  const tags = useQuery(tagsQuery(api));
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [errors, setErrors] = useState<CollectionErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    const found = textErrors(name, slug, TAG_TEXT_MAX);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setBusy(true);
    try {
      await createTag(api, { name: name.trim(), slug: slug.trim() });
      await queryClient.invalidateQueries({ queryKey: tagKeys.all });
      setName("");
      setSlug("");
      setSlugTouched(false);
      setMessage("Đã thêm tag.");
    } catch (error) {
      const failure = collectionErrorText(error);
      if (failure.field) setErrors({ slug: failure.text });
      else setMessage(failure.text);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card role="region" aria-labelledby={titleId} className="gap-4 p-5">
      <h2 id={titleId} className="text-title">
        Tag
      </h2>
      {message ? <FormAlert tone={message.startsWith("Đã") ? "success" : "danger"}>{message}</FormAlert> : null}
      {!tags.data ? (
        <Skeleton className="h-24 w-full" />
      ) : tags.data.length === 0 ? (
        <p className="text-body text-ink-muted">Chưa có tag nào.</p>
      ) : (
        <Table.Root aria-label="Tag">
          <Table.Head>
            <Table.Row>
              <Table.HeaderCell>Tag</Table.HeaderCell>
              <Table.HeaderCell>Đường dẫn</Table.HeaderCell>
              <Table.HeaderCell>
                <span className="sr-only">Thao tác</span>
              </Table.HeaderCell>
            </Table.Row>
          </Table.Head>
          <Table.Body>
            {tags.data.map((tag) =>
              editing === tag.tagId ? (
                <TagEditRow key={tag.tagId} tag={tag} onDone={() => setEditing(null)} />
              ) : (
                <Table.Row key={tag.tagId}>
                  <Table.Cell className="font-medium">{tag.name}</Table.Cell>
                  <Table.Cell translate="no" className="font-mono text-label">
                    {tag.slug}
                  </Table.Cell>
                  <Table.Cell className="text-right">
                    {canManage ? (
                      <Button variant="ghost" density="compact" aria-label={`Sửa tag ${tag.name}`} onClick={() => setEditing(tag.tagId)}>
                        Sửa
                      </Button>
                    ) : null}
                  </Table.Cell>
                </Table.Row>
              ),
            )}
          </Table.Body>
        </Table.Root>
      )}
      {canManage ? (
        <form className="grid gap-2" onSubmit={(e) => void add(e)} noValidate aria-label="Thêm tag">
          <div className="flex flex-wrap items-start gap-2">
            <Field.Root className="min-w-[180px] flex-1 gap-1">
              <Field.Label>Tag mới</Field.Label>
              <Field.Input
                autoComplete="off"
                maxLength={TAG_TEXT_MAX}
                placeholder="Ví dụ: Mới…"
                value={name}
                onChange={(e) => {
                  const v = e.currentTarget.value;
                  setName(v);
                  if (!slugTouched) setSlug(slugify(v, TAG_TEXT_MAX));
                }}
              />
              {errors.name ? <Field.Error aria-live="polite">{errors.name}</Field.Error> : null}
            </Field.Root>
            <Field.Root className="min-w-[160px] flex-1 gap-1">
              <Field.Label>Đường dẫn tag</Field.Label>
              <Field.Input
                autoComplete="off"
                spellCheck={false}
                autoCapitalize="none"
                translate="no"
                maxLength={TAG_TEXT_MAX}
                className="font-mono"
                value={slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(e.currentTarget.value);
                }}
              />
              {errors.slug ? <Field.Error aria-live="polite">{errors.slug}</Field.Error> : null}
            </Field.Root>
            <Button type="submit" variant="outline" className="mt-7" busy={busy}>
              Thêm
            </Button>
          </div>
          <p className="text-caption text-ink-muted">Gắn tag cho từng món ở tab “Lịch bán &amp; tag” của món.</p>
        </form>
      ) : null}
    </Card>
  );
}

function TagEditRow({ tag, onDone }: { tag: Tag; onDone: () => void }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const [name, setName] = useState(tag.name);
  const [slug, setSlug] = useState(tag.slug);
  const [errors, setErrors] = useState<CollectionErrors>({});
  const [busy, setBusy] = useState(false);

  async function save() {
    const found = textErrors(name, slug, TAG_TEXT_MAX);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const body = { ...(name.trim() !== tag.name && { name: name.trim() }), ...(slug.trim() !== tag.slug && { slug: slug.trim() }) };
    if (Object.keys(body).length === 0) {
      onDone();
      return;
    }
    setBusy(true);
    try {
      await updateTag(api, tag.tagId, body);
      await queryClient.invalidateQueries({ queryKey: tagKeys.all });
      onDone();
    } catch (error) {
      setErrors({ slug: collectionErrorText(error).text });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Table.Row>
      <Table.Cell>
        <Field.Root className="gap-1">
          <Field.Label className="sr-only">{`Tên tag ${tag.name}`}</Field.Label>
          <Field.Input autoComplete="off" maxLength={TAG_TEXT_MAX} value={name} onChange={(e) => setName(e.currentTarget.value)} />
          {errors.name ? <Field.Error aria-live="polite">{errors.name}</Field.Error> : null}
        </Field.Root>
      </Table.Cell>
      <Table.Cell>
        <Field.Root className="gap-1">
          <Field.Label className="sr-only">{`Đường dẫn tag ${tag.name}`}</Field.Label>
          <Field.Input autoComplete="off" spellCheck={false} translate="no" maxLength={TAG_TEXT_MAX} className="font-mono" value={slug} onChange={(e) => setSlug(e.currentTarget.value)} />
          {errors.slug ? <Field.Error aria-live="polite">{errors.slug}</Field.Error> : null}
        </Field.Root>
      </Table.Cell>
      <Table.Cell className="text-right whitespace-nowrap">
        <Button variant="ghost" density="compact" onClick={onDone}>
          Huỷ
        </Button>
        <Button density="compact" busy={busy} onClick={() => void save()}>
          Lưu
        </Button>
      </Table.Cell>
    </Table.Row>
  );
}
