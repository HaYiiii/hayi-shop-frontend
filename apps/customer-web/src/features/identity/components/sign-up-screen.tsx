"use client";

import { Button, Field, cn, focusRing } from "@hayi/ui";
import { useMutation } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { type FormEvent, useState } from "react";
import { errorCode, useCustomerApi } from "../../../lib/customer-api";
import { PASSWORD_MAX, PASSWORD_MIN, maskPhone, register } from "../api/registration";
import { LoginScreen } from "./login-screen";
import { type CodeSent, CodeStep, NeedsNewCode, PhoneStep, type Sending, StepHeader, formText, useCodeSending } from "./otp-steps";

type Step =
  | { name: "phone" }
  | ({ name: "code" } & CodeSent)
  | { name: "details"; phone: string; verificationToken: string }
  | { name: "done"; phone: string; created: "new" | "linked" | undefined };

/** D3a screen 8 (code step) + D3f 8b / 8c: sign-up in three steps; no session afterwards (Decision AN4). */
export function SignUpScreen() {
  const [step, setStep] = useState<Step>({ name: "phone" });
  const sendCode = useCodeSending("REGISTRATION", (sent) => setStep({ name: "code", ...sent }));

  if (step.name === "done") return <LoginScreen defaultPhone={step.phone} created={step.created} />;

  const number = step.name === "phone" ? 1 : step.name === "code" ? 2 : 3;
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-content flex-col">
      <StepHeader
        back={step.name === "phone" ? { href: "/login", label: "Quay lại" } : { onClick: () => setStep({ name: "phone" }), label: "Quay lại" }}
        step={number}
      />
      <main className="flex flex-1 flex-col gap-5 px-5 pb-6">
        {step.name === "phone" ? (
          <PhoneStep
            sending={sendCode}
            heading={
              <>
                <Image src="/logo.webp" alt="HaYi Shop" width={88} height={88} priority className="size-22 self-center" />
                <div className="grid gap-1.5 text-center">
                  <h1 className="font-display text-heading-lg text-balance">Tạo tài khoản</h1>
                  <p className="text-body text-ink-muted">Nhận mã 6 số qua tin nhắn để xác minh số điện thoại.</p>
                </div>
              </>
            }
            footer={
              <p className="text-center text-body">
                Đã có tài khoản?{" "}
                <Link href="/login" className={cn("inline-flex min-h-11 items-center font-medium text-matcha-700 underline-offset-4 hover:underline", focusRing)}>
                  Đăng nhập
                </Link>
              </p>
            }
          />
        ) : step.name === "code" ? (
          <CodeStep
            key={`${step.challenge.challengeId}-${step.sentAt}`}
            sent={step}
            sending={sendCode}
            onChangePhone={() => setStep({ name: "phone" })}
            onVerified={(verificationToken) => setStep({ name: "details", phone: step.phone, verificationToken })}
          />
        ) : (
          <DetailsStep
            phone={step.phone}
            verificationToken={step.verificationToken}
            sending={sendCode}
            onDone={(created) => setStep({ name: "done", phone: step.phone, created })}
          />
        )}
      </main>
    </div>
  );
}

interface DetailsStepProps {
  phone: string;
  verificationToken: string;
  sending: Sending;
  /** "new": a new password; "linked": the phone's existing account (current password); none: already a Customer. */
  onDone: (created: "new" | "linked" | undefined) => void;
}

/** Step 3 (D3f 8b): name + password; a phone that already has an account (Staff) gives its current password. */
function DetailsStep({ phone, verificationToken, sending, onDone }: DetailsStepProps) {
  const api = useCustomerApi();
  const [existing, setExisting] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [local, setLocal] = useState<{ name?: string; password?: string }>({});
  const create = useMutation({
    mutationFn: (body: { password?: string; currentPassword?: string }) => register(api, { verificationToken, displayName: displayName.trim(), ...body }),
    onSuccess: () => onDone(existing ? "linked" : "new"),
    onError: (error) => {
      if (errorCode(error) === "AUTH_CURRENT_PASSWORD_REQUIRED") {
        setExisting(true);
        create.reset();
      }
    },
  });
  const code = errorCode(create.error);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const field = existing ? "currentPassword" : "password";
    const password = formText(event.currentTarget, field);
    const errors = {
      ...(!displayName.trim() && { name: "Nhập tên hiển thị." }),
      ...(!password
        ? { password: existing ? "Nhập mật khẩu hiện có." : "Nhập mật khẩu." }
        : !existing && password.length < PASSWORD_MIN
          ? { password: `Mật khẩu cần ít nhất ${PASSWORD_MIN} ký tự.` }
          : !existing && password.length > PASSWORD_MAX
            ? { password: `Mật khẩu tối đa ${PASSWORD_MAX} ký tự.` }
            : {}),
    };
    setLocal(errors);
    if (errors.name || errors.password) return;
    create.mutate(existing ? { currentPassword: password } : { password });
  }

  if (code === "AUTH_INVALID_CREDENTIALS" || code === "VERIFICATION_TOKEN_INVALID") {
    // A wrong current password spends the proof (AN4); an old proof needs a new code too.
    return (
      <NeedsNewCode
        title={code === "AUTH_INVALID_CREDENTIALS" ? "Mật khẩu hiện có chưa đúng. Gửi mã mới để thử lại." : "Phiên xác minh đã hết hạn."}
        phone={phone}
        sending={sending}
      >
        {code === "AUTH_INVALID_CREDENTIALS" ? "Mã xác minh chỉ dùng được một lần." : "Gửi mã mới để tiếp tục."}
      </NeedsNewCode>
    );
  }

  const passwordError =
    local.password ?? (code === "AUTH_PASSWORD_POLICY_VIOLATION" ? "Mật khẩu này dễ đoán. Chọn mật khẩu khác." : undefined);

  return (
    <>
      <div className="grid gap-1.5">
        <h1 className="font-display text-heading-lg text-balance">{existing ? "Số này đã có tài khoản" : "Hoàn tất tài khoản"}</h1>
        <p className="text-body text-ink-muted">
          Số <strong className="font-semibold text-ink tabular-nums">{maskPhone(phone)}</strong>{" "}
          {existing ? "đang dùng cho tài khoản nhân viên HaYi. Nhập mật khẩu hiện có để dùng chung một tài khoản đặt món." : "đã được xác minh."}
        </p>
      </div>
      <form className="grid gap-3.5" onSubmit={submit} aria-label={existing ? "Xác nhận tài khoản" : "Tạo tài khoản"} noValidate>
        {code === "CUSTOMER_ALREADY_REGISTERED" ? (
          <div role="alert" className="grid justify-items-start gap-1 rounded-md bg-warning-soft px-3 py-2.5 text-body text-warning">
            Số này đã có tài khoản đặt món.
            <Button variant="outline" density="compact" onClick={() => onDone(undefined)}>
              Đăng nhập
            </Button>
          </div>
        ) : create.isError && code !== "AUTH_PASSWORD_POLICY_VIOLATION" ? (
          <p role="alert" className="rounded-md bg-danger-soft px-3 py-2.5 text-body text-danger">
            Chưa tạo được tài khoản. Bạn thử lại sau ít phút nhé.
          </p>
        ) : null}
        <Field.Root>
          <Field.Label>Tên hiển thị</Field.Label>
          <Field.Input name="displayName" autoComplete="name" density="touch" value={displayName} onChange={(e) => setDisplayName(e.currentTarget.value)} />
          {local.name ? <Field.Error>{local.name}</Field.Error> : existing ? null : <Field.Hint>Quầy gọi tên này khi đơn sẵn sàng.</Field.Hint>}
        </Field.Root>
        {existing ? (
          <Field.Root key="current">
            <Field.Label>Mật khẩu hiện có</Field.Label>
            <Field.Input name="currentPassword" type="password" autoComplete="current-password" density="touch" />
            {passwordError ? <Field.Error>{passwordError}</Field.Error> : null}
            <Link
              href="/forgot-password"
              className={cn("inline-flex min-h-11 items-center self-end font-medium text-matcha-700 underline-offset-4 hover:underline", focusRing)}
            >
              Quên mật khẩu?
            </Link>
          </Field.Root>
        ) : (
          <Field.Root key="new">
            <Field.Label>Mật khẩu</Field.Label>
            <Field.Input name="password" type="password" autoComplete="new-password" density="touch" />
            {passwordError ? <Field.Error>{passwordError}</Field.Error> : <Field.Hint>Ít nhất 8 ký tự. Tránh mật khẩu dễ đoán như 12345678.</Field.Hint>}
          </Field.Root>
        )}
        <Button type="submit" block density="touch" busy={create.isPending}>
          {existing ? "Xác nhận" : "Tạo tài khoản"}
        </Button>
      </form>
      {existing ? null : <p className="text-center text-caption text-ink-muted">Tạo xong, bạn đăng nhập bằng số điện thoại và mật khẩu này.</p>}
    </>
  );
}
