"use client";

import { ApiError } from "@hayi/api-client";
import { Button, Field, cn, focusRing } from "@hayi/ui";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { type FormEvent, type ReactNode, useEffect, useRef, useState } from "react";
import { errorCode, useCustomerApi } from "../../../lib/customer-api";
import { OTP_MAX_ATTEMPTS, type OtpPurpose, type OtpSent, maskPhone, minutesFrom, requestCode, verifyCode } from "../api/registration";

/**
 * The phone and code steps shared by sign-up (FE #71) and password recovery (FE #73): screen 8's code step and
 * D3f 8c (wrong code, expired, too many codes).
 */

export function formText(form: HTMLFormElement, name: string): string {
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

export const isLimited = (error: unknown) => errorCode(error) === "RATE_LIMITED";

export type CodeSent = { phone: string; challenge: OtpSent; sentAt: number };
export type Sending = ReturnType<typeof useCodeSending>;

/**
 * Asking for a code (`POST /auth/otp`) for this purpose. A RATE_LIMITED answer ends on its own: it is cleared after
 * `Retry-After`, so asking works again (like the sign-in lock).
 */
export function useCodeSending(purpose: OtpPurpose, onSent: (sent: CodeSent) => void) {
  const api = useCustomerApi();
  const sending = useMutation({
    mutationFn: (phone: string) => requestCode(api, phone, purpose).then((challenge) => ({ phone, challenge, sentAt: Date.now() })),
    onSuccess: onSent,
  });
  const waitMs = isLimited(sending.error) && sending.error instanceof ApiError ? Number(sending.error.problem.retryAfterSeconds ?? 60) * 1000 : 0;
  const { reset } = sending;
  useEffect(() => {
    if (!waitMs) return;
    const timer = setTimeout(reset, waitMs);
    return () => clearTimeout(timer);
  }, [waitMs, reset]);
  return sending;
}

/** "Bạn đã yêu cầu quá nhiều mã" (D3f 8c, limited): RATE_LIMITED on asking for a first code. */
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

/** RATE_LIMITED on a resend: the code already received still works, so only sending another waits (FE #71 review). */
function LimitedNotice({ error }: { error: unknown }) {
  const minutes = error instanceof ApiError ? minutesFrom(error.problem.retryAfterSeconds) : null;
  return (
    <p role="alert" className="rounded-md bg-danger-soft px-3 py-2.5 text-body text-danger">
      {`Bạn đã yêu cầu quá nhiều mã. Gửi mã mới được sau ${minutes ?? "ít"} phút.`}
    </p>
  );
}

/** A problem that needs a new code first (D3f 8c, expired), with the button that sends it. */
export function NeedsNewCode({ title, children, phone, sending }: { title: string; children: ReactNode; phone: string; sending: Sending }) {
  const limited = isLimited(sending.error);
  return (
    <div className="grid gap-3.5">
      <div role="alert" className="grid gap-0.5 rounded-lg bg-warning-soft p-3">
        <p className="text-body-lg font-semibold text-warning">{title}</p>
        <p className="text-body">{children}</p>
      </div>
      {limited ? <LimitedNotice error={sending.error} /> : null}
      <Button block density="touch" busy={sending.isPending} disabled={limited} onClick={() => sending.mutate(phone)}>
        Gửi mã mới
      </Button>
    </div>
  );
}

/** "Quay lại" and "Bước n/3" above each step. */
export function StepHeader({ back, step }: { back: { href: string; label: string } | { onClick: () => void; label: string }; step?: number }) {
  const className = cn("grid size-11 place-items-center rounded-md text-ink", focusRing);
  return (
    <header className="flex items-center gap-1 px-1 py-2">
      {"href" in back ? (
        <Link href={back.href} aria-label={back.label} className={className}>
          <BackIcon />
        </Link>
      ) : (
        <button type="button" aria-label={back.label} className={className} onClick={back.onClick}>
          <BackIcon />
        </button>
      )}
      {step ? <span className="text-label text-ink-muted">{`Bước ${step}/3`}</span> : null}
    </header>
  );
}

interface PhoneStepProps {
  sending: Sending;
  /** Heading, intro and anything above or below the form (logo, links): each flow's own copy. */
  heading: ReactNode;
  footer?: ReactNode;
}

/** Step 1: the phone to send a code to. */
export function PhoneStep({ sending, heading, footer }: PhoneStepProps) {
  const [missing, setMissing] = useState(false);
  const invalid = sending.error instanceof ApiError && sending.error.status === 400;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const phone = formText(event.currentTarget, "phone").replace(/[\s.-]/g, "");
    setMissing(!phone);
    if (phone) sending.mutate(phone);
  }

  if (isLimited(sending.error)) return <TooManyCodes error={sending.error} />;

  return (
    <>
      {heading}
      <form className="grid gap-3.5" onSubmit={submit} aria-label="Nhận mã xác minh" noValidate>
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
      {footer}
    </>
  );
}

interface CodeStepProps {
  sent: CodeSent;
  sending: Sending;
  onChangePhone: () => void;
  onVerified: (verificationToken: string) => void;
}

/** Step 2 (screen 8 code step, D3f 8c): the code, wrong codes left (counted here, agreed on #71), resend countdown. */
export function CodeStep({ sent, sending, onChangePhone, onVerified }: CodeStepProps) {
  const api = useCustomerApi();
  const { phone, challenge, sentAt } = sent;
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
      {code === "OTP_CHALLENGE_LOCKED" || code === "OTP_CHALLENGE_INVALID" ? (
        <NeedsNewCode title="Mã đã hết hạn hoặc nhập sai quá 5 lần" phone={phone} sending={sending}>
          Gửi mã mới để tiếp tục.
        </NeedsNewCode>
      ) : (
        <form className="grid gap-3.5" onSubmit={submit} aria-label="Xác minh số điện thoại" noValidate>
          {isLimited(sending.error) ? <LimitedNotice error={sending.error} /> : null}
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
          <Button variant="ghost" block disabled={resendIn > 0 || isLimited(sending.error)} busy={sending.isPending} onClick={() => sending.mutate(phone)}>
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

function BackIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.5 4.5 7 10l5.5 5.5" />
    </svg>
  );
}
