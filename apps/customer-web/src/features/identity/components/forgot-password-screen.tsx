"use client";

import { Button, Field, cn, focusRing } from "@hayi/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { type FormEvent, useState } from "react";
import { errorCode, meKey, useCustomerApi } from "../../../lib/customer-api";
import { PASSWORD_POLICY_TEXT, newPasswordProblem, resetPassword } from "../api/registration";
import { type CodeSent, CodeStep, NeedsNewCode, PhoneStep, type Sending, StepHeader, formText, useCodeSending } from "./otp-steps";

type Step = { name: "phone" } | ({ name: "code" } & CodeSent) | { name: "password"; phone: string; verificationToken: string } | { name: "done" };

/** D3f 8d: forgot password — phone, code (shared with sign-up), new password, then sign in again (Decision AS1–AS2). */
export function ForgotPasswordScreen() {
  const [step, setStep] = useState<Step>({ name: "phone" });
  const sendCode = useCodeSending("PASSWORD_RECOVERY", (sent) => setStep({ name: "code", ...sent }));

  if (step.name === "done") return <Done />;

  const number = step.name === "phone" ? 1 : step.name === "code" ? 2 : 3;
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-content flex-col">
      <StepHeader
        back={step.name === "phone" ? { href: "/login", label: "Quay lại đăng nhập" } : { onClick: () => setStep({ name: "phone" }), label: "Quay lại" }}
        step={number}
      />
      <main className="flex flex-1 flex-col gap-5 px-5 pb-6">
        {step.name === "phone" ? (
          <PhoneStep
            sending={sendCode}
            heading={
              <div className="grid gap-1.5">
                <h1 className="font-display text-heading-lg text-balance">Quên mật khẩu</h1>
                <p className="text-body text-ink-muted">Nhập số điện thoại đã đăng ký. Nếu số có tài khoản, bạn sẽ nhận mã 6 số.</p>
              </div>
            }
          />
        ) : step.name === "code" ? (
          <CodeStep
            key={`${step.challenge.challengeId}-${step.sentAt}`}
            sent={step}
            sending={sendCode}
            onChangePhone={() => setStep({ name: "phone" })}
            onVerified={(verificationToken) => setStep({ name: "password", phone: step.phone, verificationToken })}
          />
        ) : (
          <NewPasswordStep phone={step.phone} verificationToken={step.verificationToken} sending={sendCode} onDone={() => setStep({ name: "done" })} />
        )}
      </main>
    </div>
  );
}

function NewPasswordStep({ phone, verificationToken, sending, onDone }: { phone: string; verificationToken: string; sending: Sending; onDone: () => void }) {
  const api = useCustomerApi();
  const queryClient = useQueryClient();
  const [local, setLocal] = useState<string | null>(null);
  const reset = useMutation({
    mutationFn: (newPassword: string) => resetPassword(api, verificationToken, newPassword),
    onSuccess: () => {
      // Every session of the User ended (AS2), this browser's too.
      queryClient.setQueryData(meKey, null);
      onDone();
    },
  });
  const code = errorCode(reset.error);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = formText(event.currentTarget, "newPassword");
    const problem = newPasswordProblem(password);
    setLocal(problem);
    if (!problem) reset.mutate(password);
  }

  if (code === "VERIFICATION_TOKEN_INVALID") {
    return (
      <NeedsNewCode title="Phiên xác minh đã hết hạn." phone={phone} sending={sending}>
        Gửi mã mới để tiếp tục.
      </NeedsNewCode>
    );
  }

  const fieldError = local ?? (code === "AUTH_PASSWORD_POLICY_VIOLATION" ? PASSWORD_POLICY_TEXT : null);
  return (
    <>
      <div className="grid gap-1.5">
        <h1 className="font-display text-heading-lg text-balance">Đặt mật khẩu mới</h1>
        <p className="text-body text-ink-muted">Sau khi đổi, các thiết bị khác đang đăng nhập sẽ bị đăng xuất.</p>
      </div>
      <form className="grid gap-3.5" onSubmit={submit} aria-label="Đặt mật khẩu" noValidate>
        {reset.isError && code !== "AUTH_PASSWORD_POLICY_VIOLATION" ? (
          <p role="alert" className="rounded-md bg-danger-soft px-3 py-2.5 text-body text-danger">
            Chưa đổi được mật khẩu. Bạn thử lại sau ít phút nhé.
          </p>
        ) : null}
        <Field.Root>
          <Field.Label>Mật khẩu mới</Field.Label>
          <Field.Input name="newPassword" type="password" autoComplete="new-password" density="touch" />
          {fieldError ? <Field.Error>{fieldError}</Field.Error> : <Field.Hint>Ít nhất 8 ký tự. Tránh mật khẩu dễ đoán.</Field.Hint>}
        </Field.Root>
        <Button type="submit" block density="touch" busy={reset.isPending}>
          Lưu mật khẩu
        </Button>
      </form>
    </>
  );
}

function Done() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-content flex-col items-center gap-5 px-5 pt-16 pb-6 text-center">
      <span aria-hidden="true" className="grid size-16 place-items-center rounded-full bg-success-soft text-success">
        <svg viewBox="0 0 28 28" className="size-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m7 14.5 4.5 4.5L21 9.5" />
        </svg>
      </span>
      <h1 className="font-display text-heading-lg text-balance">Đã đổi mật khẩu</h1>
      <p className="max-w-[30ch] text-body text-ink-muted">Đăng nhập lại bằng mật khẩu mới để tiếp tục đặt món.</p>
      {/* A link styled as the primary button (the design's "Đăng nhập"). */}
      <Link
        href="/login"
        className={cn(
          "inline-flex h-control-touch w-full items-center justify-center rounded-md bg-matcha-700 px-5 text-body-lg font-semibold text-on-primary no-underline hover:bg-matcha-800",
          focusRing,
        )}
      >
        Đăng nhập
      </Link>
    </main>
  );
}
