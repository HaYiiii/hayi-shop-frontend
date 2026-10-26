import { Button, Card, Field, cn } from "@hayi/ui";
import { useMutation } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { errorCode, unwrap, useApi } from "../../api";
import { commonAuthMessage } from "./auth-errors";
import { AuthLayout, AuthTitle, Logo } from "./auth-layout";
import { FormAlert } from "./form-alert";
import type { LoginNotice } from "./login-form";

/** Decision K4: 12–128 characters; "different from current" and "not common" are checked by the server. */
const MIN_LENGTH = 12;
const MAX_LENGTH = 128;

interface FirstPasswordFormProps {
  changeToken: string;
  identifier: string;
  /** Password set; the user signs in again with it (Decision K3). */
  onChanged: () => void;
  onRestart: (notice?: LoginNotice) => void;
}

function Rule({ met, children }: { met: boolean | null; children: string }) {
  return (
    <li className={cn("flex items-center gap-2", met ? "text-success" : "text-ink-muted")}>
      <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        {met ? <path d="M5 10.5l3 3 7-7" strokeWidth="1.8" /> : <circle cx="10" cy="10" r="6.5" strokeWidth="1.5" />}
      </svg>
      <span>
        {children}
        <span className="sr-only">{met === null ? " (kiểm tra khi lưu)" : met ? " (đạt)" : " (chưa đạt)"}</span>
      </span>
    </li>
  );
}

export function FirstPasswordForm({ changeToken, identifier, onChanged, onRestart }: FirstPasswordFormProps) {
  const api = useApi();
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ length?: boolean; mismatch?: boolean }>({});
  const change = useMutation({
    mutationFn: (newPassword: string) =>
      unwrap(api.POST("/auth/password/first-change", { body: { changeToken, newPassword } })),
    onSuccess: onChanged,
    onError: (error) => {
      if (errorCode(error) === "AUTH_REQUIRED") onRestart("challenge-expired");
    },
  });

  const lengthOk = password.length >= MIN_LENGTH && password.length <= MAX_LENGTH;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const confirm = String(new FormData(form).get("confirmPassword"));
    const next = { length: !lengthOk, mismatch: confirm !== password };
    setErrors(next);
    const firstInvalid = next.length ? "newPassword" : next.mismatch ? "confirmPassword" : null;
    if (firstInvalid) form.querySelector<HTMLInputElement>(`[name="${firstInvalid}"]`)?.focus();
    else change.mutate(password);
  }

  const policyRejected = errorCode(change.error) === "AUTH_PASSWORD_POLICY_VIOLATION";

  return (
    <AuthLayout width="default">
      <div className="grid gap-2">
        <Logo size={56} />
        <AuthTitle>Đặt mật khẩu mới</AuthTitle>
        <p className="text-body text-ink-muted">
          Bạn đang dùng mật khẩu tạm do quản lý cấp. Đặt mật khẩu riêng để tiếp tục.
        </p>
      </div>

      <Card className="p-6">
        <form className="grid gap-4" onSubmit={submit} noValidate>
          {change.isError && !policyRejected ? <FormAlert tone="danger">{commonAuthMessage(change.error)}</FormAlert> : null}
          <input type="text" name="username" autoComplete="username" value={identifier} readOnly hidden />
          <Field.Root>
            <Field.Label>Mật khẩu mới</Field.Label>
            <Field.Input
              name="newPassword"
              type="password"
              autoComplete="new-password"
              maxLength={MAX_LENGTH}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-describedby="pw-rules"
            />
            {errors.length ? <Field.Error>Mật khẩu cần từ {MIN_LENGTH} đến {MAX_LENGTH} ký tự.</Field.Error> : null}
            {policyRejected ? (
              <Field.Error>Mật khẩu này quá phổ biến hoặc trùng mật khẩu hiện tại. Bạn chọn mật khẩu khác nhé.</Field.Error>
            ) : null}
          </Field.Root>
          <ul id="pw-rules" className="grid gap-1.5 text-label font-normal">
            <Rule met={lengthOk}>{`Từ ${MIN_LENGTH} ký tự trở lên`}</Rule>
            <Rule met={null}>Khác mật khẩu tạm</Rule>
            <Rule met={null}>Không nằm trong danh sách mật khẩu phổ biến</Rule>
          </ul>
          <Field.Root>
            <Field.Label>Nhập lại mật khẩu mới</Field.Label>
            <Field.Input name="confirmPassword" type="password" autoComplete="new-password" maxLength={MAX_LENGTH} />
            {errors.mismatch ? <Field.Error>Hai mật khẩu chưa khớp. Bạn nhập lại ô này nhé.</Field.Error> : null}
          </Field.Root>
          <Button type="submit" block busy={change.isPending}>
            Lưu mật khẩu và tiếp tục
          </Button>
        </form>
      </Card>

      <p className="text-center text-caption text-ink-subtle">
        Sau khi đổi, bạn đăng nhập lại bằng mật khẩu mới.
      </p>
    </AuthLayout>
  );
}
