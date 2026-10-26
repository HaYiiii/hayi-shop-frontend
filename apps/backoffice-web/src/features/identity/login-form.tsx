import { ApiError, type BackofficeComponents } from "@hayi/api-client";
import { Button, Card, Field } from "@hayi/ui";
import { useMutation } from "@tanstack/react-query";
import { type FormEvent, useEffect, useState } from "react";
import { errorCode, unwrap, useApi } from "../../api";
import { commonAuthMessage, isLocked } from "./auth-errors";
import { AuthLayout, AuthTitle, Logo } from "./auth-layout";
import { FormAlert } from "./form-alert";

type LoginResponse = BackofficeComponents["schemas"]["LoginResponse"];

export type LoginNotice = "password-changed" | "challenge-locked" | "challenge-expired";

const notices: Record<LoginNotice, { tone: "success" | "danger"; text: string }> = {
  "password-changed": { tone: "success", text: "Đã đổi mật khẩu. Đăng nhập lại bằng mật khẩu mới để tiếp tục." },
  "challenge-locked": { tone: "danger", text: "Nhập sai mã quá nhiều lần. Bạn đăng nhập lại để nhận lượt mới." },
  "challenge-expired": { tone: "danger", text: "Phiên xác thực đã hết hạn. Bạn đăng nhập lại nhé." },
};

function errorMessage(error: unknown): string {
  if (errorCode(error) === "AUTH_INVALID_CREDENTIALS") {
    return "Tài khoản hoặc mật khẩu chưa đúng. Sai 5 lần liên tiếp, tài khoản sẽ tạm khóa 15 phút.";
  }
  return commonAuthMessage(error);
}

interface LoginFormProps {
  defaultIdentifier: string;
  notice?: LoginNotice | undefined;
  onResult: (result: LoginResponse, identifier: string) => void;
}

export function LoginForm({ defaultIdentifier, notice, onResult }: LoginFormProps) {
  const api = useApi();
  const [showPassword, setShowPassword] = useState(false);
  const login = useMutation({
    mutationFn: (body: { identifier: string; password: string }) =>
      unwrap(api.POST("/auth/login", { body })).then((result) => ({ result, identifier: body.identifier })),
    onSuccess: ({ result, identifier }) => onResult(result, identifier),
  });

  const locked = isLocked(login.error);
  const lockMs = locked && login.error instanceof ApiError ? Number(login.error.problem.retryAfterSeconds) * 1000 : 0;
  const { reset } = login;
  useEffect(() => {
    if (!lockMs) return;
    const timer = setTimeout(reset, lockMs);
    return () => clearTimeout(timer);
  }, [lockMs, reset]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    login.mutate({ identifier: String(form.get("identifier")).trim(), password: String(form.get("password")) });
  }

  const invalidCredentials = errorCode(login.error) === "AUTH_INVALID_CREDENTIALS";

  return (
    <AuthLayout>
      <div className="flex flex-col items-center gap-3 text-center">
        <Logo size={96} />
        <AuthTitle>Đăng nhập Backoffice</AuthTitle>
        <p className="text-body text-ink-muted">Dành cho nhân viên và quản lý HaYi Shop</p>
      </div>

      <Card className="p-6">
        <form className="grid gap-4" onSubmit={submit} aria-label="Thông tin đăng nhập">
          {login.isError ? (
            <FormAlert tone={locked ? "warning" : "danger"}>{errorMessage(login.error)}</FormAlert>
          ) : notice ? (
            <FormAlert tone={notices[notice].tone}>{notices[notice].text}</FormAlert>
          ) : null}

          <Field.Root>
            <Field.Label>Email, mã nhân viên hoặc số điện thoại</Field.Label>
            <Field.Input
              name="identifier"
              autoComplete="username"
              spellCheck={false}
              autoCapitalize="none"
              required
              defaultValue={defaultIdentifier}
              placeholder="Ví dụ: NV0012…"
            />
          </Field.Root>

          <Field.Root>
            <Field.Label>Mật khẩu</Field.Label>
            <div className="flex gap-2">
              <Field.Input
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                aria-invalid={invalidCredentials || undefined}
                className="min-w-0 flex-1"
              />
              <Button
                variant="outline"
                className="w-10 shrink-0 px-0"
                aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                onClick={() => setShowPassword((v) => !v)}
              >
                <EyeIcon open={!showPassword} />
              </Button>
            </div>
          </Field.Root>

          <Button type="submit" block busy={login.isPending} disabled={locked}>
            Đăng nhập
          </Button>
          <p className="text-center text-label text-ink-muted">Quên mật khẩu? Nhờ quản lý chi nhánh đặt lại cho bạn.</p>
        </form>
      </Card>

      <p className="text-center text-caption text-ink-subtle">
        Phiên đăng nhập trên thiết bị này tự kết thúc sau 12 giờ không dùng.
      </p>
    </AuthLayout>
  );
}

function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" />
      {open ? null : <path d="M4 4l16 16" strokeLinecap="round" />}
    </svg>
  );
}
