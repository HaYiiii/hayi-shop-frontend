import { ApiError } from "@hayi/api-client";
import { Button, Card, Field } from "@hayi/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useRef, useState } from "react";
import { errorCode, useApi } from "../../../lib/api";
import { FormAlert } from "../../../lib/form-alert";
import { branchKeys, updateBranch } from "../api/branches";
import { type Branch, fieldErrors, fieldsOf, parseLocation, patchBody, readFields } from "../branch-form";
import { AddressFields, BranchTextField, ContactFields, FieldGroup, type FieldErrors, locationError, useFocusFirstError } from "./branch-fields";

interface BranchInfoFormProps {
  branch: Branch;
  /** `changed` is false when there was nothing to send. */
  onSaved: (changed: boolean) => void;
  onReload: () => void;
}

/** Name, address, contact and coordinates: JSON Merge Patch with `If-Match` (API 09 §1.2). */
export function BranchInfoForm({ branch, onSaved, onReload }: BranchInfoFormProps) {
  const api = useApi();
  const queryClient = useQueryClient();
  const formRef = useRef<HTMLFormElement>(null);
  const [localErrors, setLocalErrors] = useState<FieldErrors>({});
  const [attempt, setAttempt] = useState(0);
  const save = useMutation({
    mutationFn: (body: Parameters<typeof updateBranch>[2]) => updateBranch(api, branch, body),
    onSuccess: (saved) => {
      queryClient.setQueryData(branchKeys.detail(saved.branchId), saved);
      void queryClient.invalidateQueries({ queryKey: branchKeys.list() });
      onSaved(true);
    },
  });
  const closed = branch.status === "CLOSED";
  const values = fieldsOf(branch);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = readFields(event.currentTarget);
    setAttempt((n) => n + 1);
    // Errors of the previous answer no longer describe what is in the form.
    save.reset();
    if (parseLocation(fields.location) === "invalid") {
      setLocalErrors({ location: locationError });
      return;
    }
    setLocalErrors({});
    const body = patchBody(branch, fields);
    if (Object.keys(body).length === 0) onSaved(false);
    else save.mutate(body);
  }

  const code = errorCode(save.error);
  const serverErrors =
    save.error instanceof ApiError && code === "VALIDATION_FAILED" ? fieldErrors(save.error.problem.errors ?? []) : {};
  const errors = { ...serverErrors, ...localErrors };
  useFocusFirstError(formRef, errors, attempt);

  return (
    <Card className="gap-5 p-6">
      <form ref={formRef} className="grid gap-5" onSubmit={submit}>
        {code === "VERSION_CONFLICT" ? (
          <Alert tone="warning" onReload={onReload}>
            Chi nhánh vừa được người khác cập nhật. Thay đổi của bạn chưa được lưu. Tải lại để xem bản mới rồi sửa tiếp.
          </Alert>
        ) : code === "BRANCH_INVALID_TRANSITION" ? (
          <Alert tone="danger" onReload={onReload}>
            Chi nhánh đã đóng nên không sửa được nữa. Tải lại để xem trạng thái mới nhất.
          </Alert>
        ) : save.isError && code !== "VALIDATION_FAILED" ? (
          <FormAlert tone="danger">Chưa lưu được thông tin. Bạn thử lại sau ít phút nhé.</FormAlert>
        ) : null}
        {closed ? (
          <p className="text-label font-normal text-ink-muted">Chi nhánh đã đóng nên không sửa được thông tin.</p>
        ) : null}

        <FieldGroup>
          <Field.Root>
            <span className="text-label text-ink">Mã chi nhánh</span>
            <span translate="no" className="flex h-control-default items-center font-mono text-label font-semibold tracking-wide">
              {branch.branchCode}
            </span>
            <span className="text-caption text-ink-subtle">Không đổi được sau khi tạo.</span>
          </Field.Root>
          <BranchTextField name="name" label="Tên hiển thị" required values={values} errors={errors} disabled={closed} autoComplete="off" />
          <AddressFields values={values} errors={errors} disabled={closed} />
          <ContactFields values={values} errors={errors} disabled={closed} />
        </FieldGroup>

        {closed ? null : (
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="reset" variant="ghost" onClick={() => {
                setLocalErrors({});
                save.reset();
              }}
            >
              Bỏ thay đổi
            </Button>
            <Button type="submit" busy={save.isPending}>
              Lưu thông tin
            </Button>
          </div>
        )}
      </form>
    </Card>
  );
}

function Alert({ tone, onReload, children }: { tone: "warning" | "danger"; onReload: () => void; children: string }) {
  return (
    <div className="grid justify-items-start gap-2">
      <FormAlert tone={tone}>{children}</FormAlert>
      <Button variant="outline" density="compact" onClick={onReload}>
        Tải lại
      </Button>
    </div>
  );
}
