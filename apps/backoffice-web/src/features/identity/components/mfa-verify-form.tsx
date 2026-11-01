import { Button, Card, Field } from "@hayi/ui";
import { useMutation } from "@tanstack/react-query";
import { type FormEvent, useRef, useState } from "react";
import { errorCode, unwrap, useApi } from "../../../lib/api";
import { commonAuthMessage } from "./auth-errors";
import { AuthLayout, AuthTitle, Logo } from "./auth-layout";
import { FormAlert } from "./form-alert";
import { OtpInput } from "./otp-input";
import type { LoginNotice } from "./login-form";

interface MfaVerifyFormProps {
  challengeId: string;
  identifier: string;
  onVerified: () => void;
  /** Back to the password step; with a notice when the challenge is spent (Decision L1). */
  onRestart: (notice?: LoginNotice) => void;
}

export function MfaVerifyForm({ challengeId, identifier, onVerified, onRestart }: MfaVerifyFormProps) {
  const api = useApi();
  const [useRecovery, setUseRecovery] = useState(false);
  const codeInput = useRef<HTMLInputElement>(null);
  const verify = useMutation({
    mutationFn: (code: string) =>
      unwrap(api.POST("/auth/mfa/verify", { body: { mfaChallengeId: challengeId, code } })),
    onSuccess: onVerified,
    onError: (error) => {
      const code = errorCode(error);
      if (code === "MFA_CHALLENGE_LOCKED") onRestart("challenge-locked");
      if (code === "AUTH_REQUIRED") onRestart("challenge-expired");
      if (code === "MFA_CODE_INVALID") codeInput.current?.select();
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = String(new FormData(event.currentTarget).get("code")).trim();
    verify.mutate(useRecovery ? code : code.replace(/\s/g, ""));
  }

  const wrongCode = errorCode(verify.error) === "MFA_CODE_INVALID";

  return (
    <AuthLayout>
      <div className="flex flex-col items-center gap-3 text-center">
        <Logo size={64} />
        <AuthTitle>Xác thực 2 lớp</AuthTitle>
        <p className="max-w-[34ch] text-body text-ink-muted">
          {useRecovery ? "Nhập một mã khôi phục đã lưu cho " : "Mở ứng dụng xác thực trên điện thoại và nhập mã 6 số đang hiển thị cho "}
          <strong className="font-semibold text-ink" translate="no">
            {identifier}
          </strong>.
        </p>
      </div>

      <Card className="p-6">
        <form className="grid gap-4" onSubmit={submit}>
          {verify.isError && !wrongCode ? <FormAlert tone="danger">{commonAuthMessage(verify.error)}</FormAlert> : null}
          <Field.Root key={useRecovery ? "recovery" : "totp"}>
            <Field.Label>{useRecovery ? "Mã khôi phục" : "Mã xác thực"}</Field.Label>
            {useRecovery ? (
              <Field.Input
                ref={codeInput}
                name="code"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                required
                autoFocus
                placeholder="Ví dụ: A7KD-29FQ…"
                className="font-mono tracking-wider"
              />
            ) : (
              <OtpInput ref={codeInput} name="code" autoFocus className="h-14 text-center" />
            )}
            {wrongCode ? (
              <Field.Error>Mã chưa đúng. Kiểm tra lại mã đang hiển thị rồi nhập lại.</Field.Error>
            ) : (
              <Field.Hint>
                {useRecovery
                  ? "Mỗi mã khôi phục chỉ dùng được một lần."
                  : "Mã đổi sau mỗi 30 giây. Sai 5 lần sẽ phải đăng nhập lại."}
              </Field.Hint>
            )}
          </Field.Root>
          <Button type="submit" block busy={verify.isPending}>
            Xác nhận
          </Button>
          <div className="flex flex-wrap justify-between gap-3 text-body font-medium">
            <Button
              variant="link"
              onClick={() => {
                setUseRecovery((v) => !v);
                verify.reset();
              }}
            >
              {useRecovery ? "Dùng mã từ ứng dụng" : "Dùng mã khôi phục"}
            </Button>
            <Button variant="link-muted" onClick={() => onRestart()}>
              Đăng nhập tài khoản khác
            </Button>
          </div>
        </form>
      </Card>

      <p className="text-center text-caption text-ink-subtle">
        Mất điện thoại? Dùng một mã khôi phục đã lưu, rồi nhờ Owner đặt lại xác thực 2 lớp.
      </p>
    </AuthLayout>
  );
}
