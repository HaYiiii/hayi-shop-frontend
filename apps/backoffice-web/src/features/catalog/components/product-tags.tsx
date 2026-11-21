import { Button, Card, Field } from "@hayi/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { errorCode, useApi } from "../../../lib/api";
import { FormAlert } from "../../../lib/form-alert";
import { tagsQuery } from "../api/collections";
import { type Product, productKeys, replaceProductTags } from "../api/products";
import { useProductPage } from "./product-page";

const TAGS_MAX = 20;
const idsOf = (product: Product) => product.tags.map((t) => t.tagId);

/** D3d screen 26, section "Tag": the Product's tags, picked from the existing ones (Decision AL2). */
export function ProductTags() {
  const api = useApi();
  const queryClient = useQueryClient();
  const titleId = useId();
  const { product, canManage, setNotice } = useProductPage();
  const readOnly = !canManage || product.status === "ARCHIVED";
  const tags = useQuery(tagsQuery(api));
  const [tagIds, setTagIds] = useState<string[]>(() => idsOf(product));
  // The version the list was made from: a newer one replaces an untouched list (the #35 pattern).
  const [base, setBase] = useState<Product>(product);
  if (product.version !== base.version && JSON.stringify(tagIds) === JSON.stringify(idsOf(base))) {
    setBase(product);
    setTagIds(idsOf(product));
  }
  const [toAdd, setToAdd] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const names = new Map([...(tags.data ?? []).map((t) => [t.tagId, t.name] as const), ...product.tags.map((t) => [t.tagId, t.name] as const)]);
  const addable = (tags.data ?? []).filter((t) => !tagIds.includes(t.tagId));

  async function save() {
    setMessage(null);
    setNotice(null);
    if (JSON.stringify(tagIds) === JSON.stringify(idsOf(base))) {
      setNotice({ tone: "success", text: "Không có thay đổi nào để lưu." });
      return;
    }
    setBusy(true);
    try {
      const saved = await replaceProductTags(api, base, tagIds);
      queryClient.setQueryData(productKeys.detail(saved.productId), saved);
      setBase(saved);
      setTagIds(idsOf(saved));
      setNotice({ tone: "success", text: "Đã lưu tag của món." });
    } catch (error) {
      const code = errorCode(error);
      setMessage(
        code === "VERSION_CONFLICT"
          ? "Món vừa được người khác cập nhật. Bấm Bỏ thay đổi để lấy bản mới rồi chọn lại tag."
          : code === "CATALOG_TAG_NOT_FOUND"
            ? "Một tag vừa bị đổi. Bấm Bỏ thay đổi rồi chọn lại."
            : "Chưa lưu được tag. Bạn thử lại sau ít phút nhé.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card role="region" aria-labelledby={titleId} className="max-w-[860px] gap-4 p-6">
      <h2 id={titleId} className="text-title">
        Tag
      </h2>
      {message ? <FormAlert tone="danger">{message}</FormAlert> : null}
      {tagIds.length === 0 ? (
        <p className="text-body text-ink-muted">Món chưa có tag.</p>
      ) : (
        <ul aria-label="Tag của món" className="flex flex-wrap gap-2">
          {tagIds.map((id) => {
            const name = names.get(id) ?? id;
            return (
              <li key={id} className="inline-flex h-9 items-center gap-1 rounded-pill bg-sunken pr-1 pl-3 text-body font-medium">
                {name}
                {readOnly ? null : (
                  <Button
                    variant="ghost"
                    density="compact"
                    aria-label={`Bỏ tag ${name}`}
                    className="size-7 rounded-full px-0"
                    onClick={() => setTagIds((ids) => ids.filter((t) => t !== id))}
                  >
                    <svg aria-hidden="true" viewBox="0 0 20 20" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                      <path d="m5 5 10 10M15 5 5 15" />
                    </svg>
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {readOnly ? null : (
        <>
          <div className="flex flex-wrap items-end gap-2">
            <Field.Root className="min-w-[220px] flex-1">
              <Field.Label>Thêm tag</Field.Label>
              <Field.Select value={toAdd} onChange={(e) => setToAdd(e.currentTarget.value)}>
                <option value="">{addable.length > 0 ? "Chọn tag…" : "Không còn tag để thêm"}</option>
                {addable.map((t) => (
                  <option key={t.tagId} value={t.tagId}>
                    {t.name}
                  </option>
                ))}
              </Field.Select>
            </Field.Root>
            <Button
              variant="outline"
              density="compact"
              aria-disabled={!toAdd || tagIds.length >= TAGS_MAX || undefined}
              onClick={() => {
                if (!toAdd || tagIds.length >= TAGS_MAX) return;
                setTagIds((ids) => [...ids, toAdd]);
                setToAdd("");
              }}
            >
              Thêm
            </Button>
          </div>
          <p className="text-caption text-ink-muted">Chọn tag có sẵn. Tạo tag mới ở “Bộ sưu tập &amp; tag”.</p>
          <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
            <Button
              variant="ghost"
              onClick={() => {
                setMessage(null);
                setBase(product);
                setTagIds(idsOf(product));
              }}
            >
              Bỏ thay đổi
            </Button>
            <Button variant="outline" busy={busy} onClick={() => void save()}>
              Lưu tag
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}
