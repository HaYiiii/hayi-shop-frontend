import { ApiError } from "@hayi/api-client";
import { Button, Card } from "@hayi/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { type FormEvent, useRef, useState } from "react";
import { errorCode, useApi } from "../../../lib/api";
import { FormAlert } from "../../../lib/form-alert";
import { branchKeys, createBranch } from "../api/branches";
import { createBody, fieldErrors, parseLocation, readFields } from "../branch-form";
import { AddressFields, BranchTextField, ContactFields, FieldGroup, type FieldErrors, locationError, useFocusFirstError } from "./branch-fields";
import { Breadcrumb } from "./breadcrumb";

/** Problem codes of `POST /branches` shown on a field (API 09 §1.1). */
function errorsOf(error: unknown): FieldErrors {
  if (errorCode(error) === "BRANCH_CODE_TAKEN") {
    return { branchCode: "Mã này đã được dùng, kể cả chi nhánh đã đóng. Bạn chọn mã khác nhé." };
  }
  if (error instanceof ApiError && error.code === "VALIDATION_FAILED") return fieldErrors(error.problem.errors ?? []);
  return {};
}

/** D3c screen 15: a new Branch starts DRAFT. */
export function BranchCreate() {
  const api = useApi();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const formRef = useRef<HTMLFormElement>(null);
  const [localErrors, setLocalErrors] = useState<FieldErrors>({});
  const [attempt, setAttempt] = useState(0);
  const create = useMutation({
    mutationFn: (body: Parameters<typeof createBranch>[1]) => createBranch(api, body),
    onSuccess: (branch) => {
      queryClient.setQueryData(branchKeys.detail(branch.branchId), branch);
      void queryClient.invalidateQueries({ queryKey: branchKeys.list() });
      void navigate({ to: "/admin/branches/$id", params: { id: branch.branchId } });
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = readFields(event.currentTarget);
    setAttempt((n) => n + 1);
    // Errors of the previous answer no longer describe what is in the form.
    create.reset();
    if (parseLocation(fields.location) === "invalid") {
      setLocalErrors({ location: locationError });
      return;
    }
    setLocalErrors({});
    create.mutate(createBody(fields));
  }

  const errors = { ...errorsOf(create.error), ...localErrors };
  useFocusFirstError(formRef, errors, attempt);
  const unexpected = create.isError && Object.keys(errorsOf(create.error)).length === 0;

  return (
    <>
      <Breadcrumb current="Tạo mới" />
      <h1 className="font-display text-heading-lg">Tạo chi nhánh</h1>

      <Card className="max-w-form gap-6 p-6">
        <form ref={formRef} className="grid gap-6" onSubmit={submit}>
          {unexpected ? <FormAlert tone="danger">Chưa tạo được chi nhánh. Bạn thử lại sau ít phút nhé.</FormAlert> : null}
          <FieldGroup legend="Định danh">
            <BranchTextField
              name="branchCode"
              label="Mã chi nhánh"
              required
              errors={errors}
              autoComplete="off"
              spellCheck={false}
              translate="no"
              maxLength={32}
              className="[&_input]:font-mono [&_input]:uppercase"
              hint="Chữ in hoa, số và dấu gạch ngang, 2–32 ký tự. Không sửa được sau khi tạo."
            />
            <BranchTextField
              name="name"
              label="Tên hiển thị"
              required
              errors={errors}
              autoComplete="off"
              hint="Khách thấy tên này khi chọn chi nhánh."
            />
          </FieldGroup>
          <FieldGroup legend="Địa chỉ">
            <AddressFields errors={errors} />
          </FieldGroup>
          <FieldGroup legend="Liên hệ">
            <ContactFields errors={errors} />
          </FieldGroup>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="mr-auto text-label font-normal text-ink-muted">
              Chi nhánh được tạo ở trạng thái Nháp. Sau đó bạn đặt giờ mở cửa rồi kích hoạt.
            </span>
            <Button asChild variant="ghost" className="no-underline">
              <Link to="/admin/branches">Hủy</Link>
            </Button>
            <Button type="submit" busy={create.isPending}>
              Tạo chi nhánh
            </Button>
          </div>
        </form>
      </Card>
    </>
  );
}
