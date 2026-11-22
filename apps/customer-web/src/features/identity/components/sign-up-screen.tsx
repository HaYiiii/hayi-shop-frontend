"use client";

import { ApiError } from "@hayi/api-client";
import { Button, Field, cn, focusRing } from "@hayi/ui";
import { useMutation } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { type FormEvent, type ReactNode, useEffect, useRef, useState } from "react";
import { errorCode, useCustomerApi } from "../../../lib/customer-api";
import { OTP_MAX_ATTEMPTS, type OtpSent, maskPhone, minutesFrom, register, requestRegistrationCode, verifyCode } from "../api/registration";
import { LoginScreen } from "./login-screen";

type Step =
  | { name: "phone" }
  | { name: "code"; phone: string; challenge: OtpSent; sentAt: number }
  | { name: "details"; phone: string; verificationToken: string }
  | { name: "done"; phone: string };

const PASSWORD_MIN = 8;
const PASSWORD_MAX = 128;

function formText(form: HTMLFormElement, name: string): string {
  const value = new FormData(form).get(name);
  return typeof value === "string" ? value : "";
}

/** Seconds left until `until` (ms), ticking each second; 0 once passed. */
function useSecondsLeft(until: number): number {
  const [now, setNow] = useState(() => Date.now());
  const running = now < until;
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [running, until]);
  return Math.max(0, Math.ceil((until - now) / 1000));
}

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

/** "Bạn đã yêu cầu quá nhiều mã" (D3f 8c, limited): RATE_LIMITED on asking for a code. */
function TooManyCodes({ error }: { error: unknown }) {
  const minutes = error instanceof ApiError ? minutesFrom(error.problem.retryAfterSeconds) : null;
  return (
    <div className="grid gap-3.5">
      <div role="alert" className="grid gap-0.5 rounded-lg bg-danger-soft p-3">
        <p className="text-body-lg font-semibold text-danger">Bạn đã yêu cầu quá nhiều mã</p>
        <p className="text-body">{`Thử lại sau ${minutes ?? "ít"} phút. Mỗi số nhận tối đa 5 mã mỗi giờ.`}</p>
      </div>
      <Button block density="touch" disabled>
        Gửi mã mới
      </Button>
      <Link href="/" className={cn("inline-flex min-h-12 items-center justify-center rounded-md border border-line-strong text-body-lg font-medium text-ink no-underline", focusRing)}>
        Xem menu trước
      </Link>
    </div>
  );
}

/** A problem that needs a new code first (D3f 8c, expired), with the button that sends it. */
function NeedsNewCode({ title, children, onResend, busy }: { title: string; children: ReactNode; onResend: () => void; busy: boolean }) {
  return (
    <div className="grid gap-3.5">
      <div role="alert" className="grid gap-0.5 rounded-lg bg-warning-soft p-3">
        <p className="text-body-lg font-semibold text-warning">{title}</p>
        <p className="text-body">{children}</p>
      </div>
      <Button block density="touch" busy={busy} onClick={onResend}>
        Gửi mã mới
      </Button>
    </div>
  );
}

/** D3a screen 8 (code step) + D3f 8b / 8c: sign-up in three steps; no session afterwards (Decision AN4). */
export function SignUpScreen() {
  const api = useCustomerApi();
  const [step, setStep] = useState<Step>({ name: "phone" });

  const sendCode = useMutation({
    mutationFn: (phone: string) => requestRegistrationCode(api, phone).then((challenge) => ({ phone, challenge })),
    onSuccess: ({ phone, challenge }) => setStep({ name: "code", phone, challenge, sentAt: Date.now() }),
  });

  if (step.name === "done") return <LoginScreen defaultPhone={step.phone} created />;

  const back =
    step.name === "phone" ? (
      <Link href="/login" aria-label="Quay lại" className={cn("grid size-11 place-items-center rounded-md text-ink", focusRing)}>
        <BackIcon />
      </Link>
    ) : (
      <button
        type="button"
        aria-label="Quay lại"
        className={cn("grid size-11 place-items-center rounded-md text-ink", focusRing)}
        onClick={() => setStep({ name: "phone" })}
      >
        <BackIcon />
      </button>
    );
  const number = step.name === "phone" ? 1 : step.name === "code" ? 2 : 3;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-content flex-col">
      <header className="flex items-center gap-1 px-1 py-2">
        {back}
        <span className="text-label text-ink-muted">{`Bước ${number}/3`}</span>
      </header>
      <main className="flex flex-1 flex-col gap-5 px-5 pb-6">
        {step.name === "phone" ? (
          <PhoneStep sending={sendCode} />
        ) : step.name === "code" ? (
          <CodeStep
            key={`${step.challenge.challengeId}-${step.sentAt}`}
            phone={step.phone}
            challenge={step.challenge}
            sentAt={step.sentAt}
            sending={sendCode}
            onChangePhone={() => setStep({ name: "phone" })}
            onVerified={(verificationToken) => setStep({ name: "details", phone: step.phone, verificationToken })}
          />
        ) : (
          <DetailsStep
            phone={step.phone}
            verificationToken={step.verificationToken}
            sending={sendCode}
            onDone={() => setStep({ name: "done", phone: step.phone })}
          />
        )}
      </main>
    </div>
  );
}

type Sending = ReturnType<typeof useMutation<{ phone: string; challenge: OtpSent }, Error, string>>;

/** Step 1 (no artboard; screen 8's pattern, agreed 2026-11-22 on #71). */
function PhoneStep({ sending }: { sending: Sending }) {
  const [missing, setMissing] = useState(false);
  const invalid = sending.error instanceof ApiError && sending.error.status === 400;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const phone = formText(event.currentTarget, "phone").replace(/[\s.-]/g, "");
    setMissing(!phone);
    if (phone) sending.mutate(phone);
  }

  if (errorCode(sending.error) === "RATE_LIMITED") return <TooManyCodes error={sending.error} />;

  return (
    <>
      <Image src="/logo.webp" alt="HaYi Shop" width={88} height={88} priority className="size-22 self-center" />
      <div className="grid gap-1.5 text-center">
        <h1 className="font-display text-heading-lg text-balance">Tạo tài khoản</h1>
        <p className="text-body text-ink-muted">Nhận mã 6 số qua tin nhắn để xác minh số điện thoại.</p>
      </div>
      <form className="grid gap-3.5" onSubmit={submit} aria-label="Số điện thoại đăng ký" noValidate>
        {sending.isError && !invalid ? (
          <p role="alert" className="rounded-md bg-danger-soft px-3 py-2.5 text-body text-danger">
            Chưa gửi được mã. Bạn thử lại sau ít phút nhé.
          </p>
        ) : null}
        <Field.Root>
          <Field.Label>Số điện thoại</Field.Label>
          <Field.Input name="phone" type="tel" inputMode="tel" autoComplete="tel" density="touch" required placeholder="Ví dụ: 0901 234 567…" className="tabular-nums" />
          {missing ? <Field.Error>Nhập số điện thoại.</Field.Error> : invalid ? <Field.Error>Số điện thoại chưa đúng. Ví dụ: 0901 234 567.</Field.Error> : null}
        </Field.Root>
        <Button type="submit" block density="touch" busy={sending.isPending}>
          Gửi mã
        </Button>
      </form>
      <p className="text-center text-body">
        Đã có tài khoản?{" "}
        <Link href="/login" className={cn("inline-flex min-h-11 items-center font-medium text-matcha-700 underline-offset-4 hover:underline", focusRing)}>
          Đăng nhập
        </Link>
      </p>
    </>
  );
}

interface CodeStepProps {
  phone: string;
  challenge: OtpSent;
  sentAt: number;
  sending: Sending;
  onChangePhone: () => void;
  onVerified: (verificationToken: string) => void;
}

/** Step 2 (screen 8 code step, D3f 8c): the code, wrong codes left (counted here, agreed on #71), resend countdown. */
function CodeStep({ phone, challenge, sentAt, sending, onChangePhone, onVerified }: CodeStepProps) {
  const api = useCustomerApi();
  const [wrong, setWrong] = useState(0);
  const [missing, setMissing] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const resendIn = useSecondsLeft(sentAt + challenge.resendAfterSeconds * 1000);
  const verify = useMutation({
    mutationFn: (code: string) => verifyCode(api, challenge.challengeId, code),
    onSuccess: (result) => onVerified(result.verificationToken),
    onError: (error) => {
      if (errorCode(error) === "OTP_CODE_INVALID") {
        setWrong((n) => n + 1);
        input.current?.select();
      }
    },
  });
  const code = errorCode(verify.error);
  const resend = () => sending.mutate(phone);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = formText(event.currentTarget, "otp").replace(/\D/g, "");
    setMissing(value.length !== 6);
    if (value.length === 6) verify.mutate(value);
  }

  return (
    <>
      <div className="grid gap-1.5 text-center">
        <h1 className="font-display text-heading-lg text-balance">Nhập mã xác minh</h1>
        <p className="text-body text-ink-muted">
          Mã 6 số đã gửi tới <strong className="font-semibold text-ink tabular-nums">{maskPhone(phone)}</strong>.{" "}
          <button type="button" onClick={onChangePhone} className={cn("font-medium text-matcha-700 underline-offset-4 hover:underline", focusRing)}>
            Đổi số
          </button>
        </p>
      </div>
      {errorCode(sending.error) === "RATE_LIMITED" ? (
        <TooManyCodes error={sending.error} />
      ) : code === "OTP_CHALLENGE_LOCKED" || code === "OTP_CHALLENGE_INVALID" ? (
        <NeedsNewCode title="Mã đã hết hạn hoặc nhập sai quá 5 lần" onResend={resend} busy={sending.isPending}>
          Gửi mã mới để tiếp tục.
        </NeedsNewCode>
      ) : (
        <form className="grid gap-3.5" onSubmit={submit} aria-label="Xác minh số điện thoại" noValidate>
          {verify.isError && code !== "OTP_CODE_INVALID" ? (
            <p role="alert" className="rounded-md bg-danger-soft px-3 py-2.5 text-body text-danger">
              Chưa xác minh được. Bạn thử lại sau ít phút nhé.
            </p>
          ) : null}
          <Field.Root>
            <Field.Label>Mã xác minh</Field.Label>
            <Field.Input
              ref={input}
              name="otp"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              spellCheck={false}
              className="h-14 text-center text-heading tracking-[0.3em] tabular-nums"
            />
            {code === "OTP_CODE_INVALID" ? (
              <Field.Error>{`Mã chưa đúng. Bạn còn ${Math.max(1, OTP_MAX_ATTEMPTS - wrong)} lần thử.`}</Field.Error>
            ) : missing ? (
              <Field.Error>Nhập đủ 6 số.</Field.Error>
            ) : (
              <Field.Hint>Mã hết hạn sau 5 phút.</Field.Hint>
            )}
          </Field.Root>
          <Button type="submit" block density="touch" busy={verify.isPending}>
            Xác minh
          </Button>
          <Button variant="ghost" block disabled={resendIn > 0} busy={sending.isPending} onClick={resend}>
            {resendIn > 0 ? (
              <>
                Gửi lại mã sau <span className="tabular-nums">{clock(resendIn)}</span>
              </>
            ) : (
              "Gửi lại mã"
            )}
          </Button>
        </form>
      )}
    </>
  );
}

interface DetailsStepProps {
  phone: string;
  verificationToken: string;
  sending: Sending;
  onDone: () => void;
}

/** Step 3 (D3f 8b): name + password; a phone that already has an account (Staff) gives its current password. */
function DetailsStep({ phone, verificationToken, sending, onDone }: DetailsStepProps) {
  const api = useCustomerApi();
  const [existing, setExisting] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [local, setLocal] = useState<{ name?: string; password?: string }>({});
  const create = useMutation({
    mutationFn: (body: { password?: string; currentPassword?: string }) => register(api, { verificationToken, displayName: displayName.trim(), ...body }),
    onSuccess: onDone,
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
        onResend={() => sending.mutate(phone)}
        busy={sending.isPending}
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
            <Button variant="outline" density="compact" onClick={onDone}>
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

function BackIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.5 4.5 7 10l5.5 5.5" />
    </svg>
  );
}
