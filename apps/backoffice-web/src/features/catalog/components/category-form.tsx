import { ApiError } from "@hayi/api-client";
import { Button, Card, Field } from "@hayi/ui";
import { type FormEvent, type RefObject, useEffect, useId, useRef, useState } from "react";
import { errorCode } from "../../../lib/api";
import { FormAlert } from "../../../lib/form-alert";
import type { Category, CategoryNode } from "../api/categories";
import {
  type CategoryFieldErrors,
  type CategoryFieldName,
  DESCRIPTION_MAX,
  NAME_MAX,
  SLUG_MAX,
  categoryFieldNames,
  createBody,
  fieldErrors,
  fieldsOf,
  isActive,
  localErrors,
  patchBody,
  readFields,
  slugify,
} from "../category-form";
import { useCreateCategory, useUpdateCategory } from "../hooks/use-categories";

interface CategoryFormProps {
  /** The whole tree, archived ones included: parents to choose and the children of the edited Category. */
  tree: readonly CategoryNode[];
  /** `null` = add a Category; otherwise edit it. */
  editing: Category | null;
  onDone: () => void;
  onReload: () => void;
}

type Mutation = ReturnType<typeof useCreateCategory> | ReturnType<typeof useUpdateCategory>;

const slugHint = "Tự tạo từ tên. Chữ thường, số và dấu gạch ngang; không trùng, kể cả với danh mục đã lưu trữ.";

/** Problem codes shown under a field (D2 "Bố cục form", like screens 15 and 22). */
function errorsOf(error: unknown, editing: Category | null, tree: readonly CategoryNode[]): CategoryFieldErrors {
  switch (errorCode(error)) {
    case "CATALOG_SLUG_TAKEN":
      return { slug: "Đường dẫn này đã được dùng, kể cả bởi danh mục đã lưu trữ. Bạn chọn đường dẫn khác nhé." };
    case "CATALOG_CATEGORY_DEPTH_EXCEEDED": {
      const hasChildren = editing && tree.find((r) => r.categoryId === editing.categoryId)?.children.length;
      return {
        parentId: hasChildren
          ? `“${editing.name}” đang có danh mục con (kể cả đã lưu trữ) nên không làm danh mục con được: menu có tối đa 2 cấp.`
          : "Chỉ chọn được danh mục gốc làm danh mục cha: menu có tối đa 2 cấp.",
      };
    }
    case "VALIDATION_FAILED":
      return error instanceof ApiError ? fieldErrors(error.problem.errors ?? []) : {};
    default:
      return {};
  }
}

/** Codes answered with an alert and "Tải lại": the tree on screen is out of date. */
function staleMessage(code: string | undefined, editing: Category | null): string | null {
  if (code === "VERSION_CONFLICT") {
    return "Danh mục vừa được người khác cập nhật. Thay đổi của bạn chưa được lưu và vẫn còn trong form. Tải lại để xem bản mới rồi lưu lại.";
  }
  if (code === "CATALOG_CATEGORY_ARCHIVED" || code === "CATALOG_CATEGORY_NOT_FOUND") {
    return editing
      ? "Danh mục này hoặc danh mục cha vừa được lưu trữ. Tải lại để xem cây mới nhất."
      : "Danh mục cha vừa được lưu trữ. Tải lại rồi chọn danh mục cha khác.";
  }
  return null;
}

/**
 * D3d screen 20, side card: "Thêm danh mục"; "Sửa" opens the same card for one Category (approved
 * patterns of screens 15/16). Typed values survive an error and a reload (`VERSION_CONFLICT`).
 */
export function CategoryForm({ tree, editing, onDone, onReload }: CategoryFormProps) {
  const create = useCreateCategory();
  const update = useUpdateCategory();
  const mutation: Mutation = editing ? update : create;
  const formRef = useRef<HTMLFormElement>(null);
  const titleId = useId();
  const [local, setLocal] = useState<CategoryFieldErrors>({});
  const [attempt, setAttempt] = useState(0);
  const [created, setCreated] = useState<string | null>(null);
  // The slug follows the name until the user types a slug of their own (create only).
  const [slugTouched, setSlugTouched] = useState(editing !== null);

  const parents = tree.filter((root) => isActive(root) && root.categoryId !== editing?.categoryId);
  // What the form was filled from. The patch is diffed against it, never against a version reloaded
  // later, or the other person's changes would be sent back with old values (lost update, API README §8).
  const [base, setBase] = useState<Category | null>(editing);
  const values = base ? fieldsOf(base) : undefined;

  // After "Tải lại" a newer version arrives: fields the user has not touched take its values, typed
  // ones stay; the base moves on, so only the typed changes are sent with the new If-Match.
  useEffect(() => {
    const form = formRef.current;
    if (!editing || !base || editing.version === base.version || !form) return;
    const before = fieldsOf(base);
    const after = fieldsOf(editing);
    const typed = readFields(form);
    for (const name of categoryFieldNames) {
      const control = form.elements.namedItem(name);
      const untouched = typed[name] === before[name];
      if (untouched && (control instanceof HTMLInputElement || control instanceof HTMLSelectElement || control instanceof HTMLTextAreaElement)) {
        control.value = after[name];
      }
    }
    setBase(editing);
  }, [editing, base]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = readFields(form);
    setAttempt((n) => n + 1);
    setCreated(null);
    // Errors of the previous answer no longer describe what is in the form.
    create.reset();
    update.reset();
    const errors = localErrors(fields);
    setLocal(errors);
    if (Object.keys(errors).length > 0) return;
    if (!editing) {
      create.mutate(createBody(fields), {
        onSuccess: (category) => {
          form.reset();
          setSlugTouched(false);
          setCreated(category.name);
        },
      });
      return;
    }
    // Diff against the base the form shows; If-Match is the newest version known.
    const body = patchBody(base ?? editing, fields);
    if (Object.keys(body).length === 0) onDone();
    else update.mutate({ category: editing, body }, { onSuccess: onDone });
  }

  function nameChanged(name: string) {
    if (slugTouched) return;
    const slug = formRef.current?.elements.namedItem("slug");
    if (slug instanceof HTMLInputElement) slug.value = slugify(name);
  }

  const code = errorCode(mutation.error);
  const errors = { ...errorsOf(mutation.error, editing, tree), ...local };
  const stale = staleMessage(code, editing);
  const unexpected = mutation.isError && !stale && Object.keys(errorsOf(mutation.error, editing, tree)).length === 0;
  useFocusFirstError(formRef, errors, attempt);

  return (
    <Card className="gap-3.5 p-5">
      <form ref={formRef} aria-labelledby={titleId} className="grid gap-3.5" onSubmit={submit} noValidate>
        <h2 id={titleId} className="text-title">
          {editing ? `Sửa “${editing.name}”` : "Thêm danh mục"}
        </h2>
        {stale ? (
          <div className="grid justify-items-start gap-2">
            <FormAlert tone="warning">{stale}</FormAlert>
            <Button
              variant="outline"
              density="compact"
              onClick={() => {
                create.reset();
                update.reset();
                onReload();
              }}
            >
              Tải lại
            </Button>
          </div>
        ) : unexpected ? (
          <FormAlert tone="danger">
            {editing ? "Chưa lưu được danh mục." : "Chưa thêm được danh mục."} Bạn thử lại sau ít phút nhé.
          </FormAlert>
        ) : created ? (
          <FormAlert tone="success">{`Đã thêm “${created}” vào cuối nhóm.`}</FormAlert>
        ) : null}

        <Field.Root>
          <Field.Label>Tên</Field.Label>
          <Field.Input
            name="name"
            defaultValue={values?.name}
            maxLength={NAME_MAX}
            autoComplete="off"
            onChange={(e) => nameChanged(e.currentTarget.value)}
          />
          {errors.name ? <Field.Error aria-live="polite">{errors.name}</Field.Error> : null}
        </Field.Root>

        <Field.Root>
          <Field.Label>Đường dẫn (slug)</Field.Label>
          <Field.Input
            name="slug"
            defaultValue={values?.slug}
            maxLength={SLUG_MAX}
            autoComplete="off"
            spellCheck={false}
            autoCapitalize="none"
            translate="no"
            className="font-mono font-semibold tracking-wide"
            onChange={() => setSlugTouched(true)}
          />
          {errors.slug ? <Field.Error aria-live="polite">{errors.slug}</Field.Error> : null}
          <Field.Hint>{editing ? "Chữ thường, số và dấu gạch ngang; không trùng, kể cả với danh mục đã lưu trữ." : slugHint}</Field.Hint>
        </Field.Root>

        <Field.Root>
          <Field.Label>Danh mục cha</Field.Label>
          <Field.Select name="parentId" defaultValue={values?.parentId ?? ""}>
            <option value="">Không có (danh mục gốc)</option>
            {parents.map((root) => (
              <option key={root.categoryId} value={root.categoryId}>
                {root.name}
              </option>
            ))}
          </Field.Select>
          {errors.parentId ? <Field.Error aria-live="polite">{errors.parentId}</Field.Error> : null}
          <Field.Hint>Chỉ chọn được danh mục gốc: menu có tối đa 2 cấp.</Field.Hint>
        </Field.Root>

        <Field.Root>
          <Field.Label>
            Mô tả <span className="font-normal text-ink-muted">(không bắt buộc)</span>
          </Field.Label>
          <Field.Textarea
            name="description"
            rows={3}
            maxLength={DESCRIPTION_MAX}
            autoComplete="off"
            defaultValue={values?.description}
            placeholder="Ví dụ: Trà ủ lạnh với trái cây tươi…"
          />
          {errors.description ? <Field.Error aria-live="polite">{errors.description}</Field.Error> : null}
        </Field.Root>

        {editing ? (
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={onDone}>
              Hủy
            </Button>
            <Button type="submit" busy={update.isPending}>
              Lưu thay đổi
            </Button>
          </div>
        ) : (
          <>
            <Button type="submit" busy={create.isPending}>
              Thêm danh mục
            </Button>
            <p className="text-caption text-ink-muted">Danh mục mới được xếp cuối nhóm. Dùng nút lên/xuống để đổi thứ tự.</p>
          </>
        )}
      </form>
    </Card>
  );
}

/** After a failed submit, put the keyboard on the first field (in form order) that has an error. */
function useFocusFirstError(form: RefObject<HTMLFormElement | null>, errors: CategoryFieldErrors, attempt: number) {
  const first = categoryFieldNames.find((name: CategoryFieldName) => errors[name]);
  useEffect(() => {
    if (!first) return;
    const control = form.current?.elements.namedItem(first);
    if (control instanceof HTMLElement) control.focus();
  }, [form, first, attempt]);
}
