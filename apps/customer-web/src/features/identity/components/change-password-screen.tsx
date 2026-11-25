"use client";

import { ApiError } from "@hayi/api-client";
import { formatBranchTime } from "@hayi/domain-utils";
import { Button, Field, Skeleton, cn, focusRing } from "@hayi/ui";
import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { errorCode, useCustomerApi } from "../../../lib/customer-api";
import { PASSWORD_POLICY_TEXT, changePassword, newPasswordProblem } from "../api/registration";
import { meQuery } from "../api/session";
import { StepHeader, formText } from "./otp-steps";

const SIGN_IN = `/login?next=${encodeURIComponent("/account/password")}`;
const isLocked = (error: unknown) => errorCode(error) === "AUTH_LOGIN_LOCKED" || errorCode(error) === "RATE_LIMITED";

/** Local time (HH:mm, Branch time) when a `429` ends, from `Retry-After`. */
function retryAt(error: unknown): string | null {
  const seconds = error instanceof ApiError ? error.problem.retryAfterSeconds : undefined;
  return typeof seconds === "number" ? formatBranchTime(new Date(Date.now() + seconds * 1000).toISOString()) : null;
}

/** D3f screen 12: change the password while signed in; other sessions end, this one stays (Decision AS3). */
export function ChangePasswordScreen() {
  const api = useCustomerApi();
  const router = useRouter();
  const me = useQuery(meQuery(api));
  const signedOut = me.isSuccess && me.data === null && !me.isFetching;
  useEffect(() => {
    if (signedOut) router.replace(SIGN_IN);
  }, [signedOut, router]);

  const [local, setLocal] = useState<{ current?: string; next?: string }>({});
  const change = useMutation({
    mutationFn: (body: { currentPassword: string; newPassword: string }) => changePassword(api, body.currentPassword, body.newPassword),
    onSuccess: () => router.replace("/account?password=changed"),
  });
  const code = errorCode(change.error);

  // A lock ends on its own: clear the error then, so the button works again.
  const lockMs = isLocked(change.error) && change.error instanceof ApiError ? Number(change.error.problem.retryAfterSeconds ?? 0) * 1000 : 0;
  const { reset } = change;
  useEffect(() => {
    if (!lockMs) return;
    const timer = setTimeout(reset, lockMs);
    return () => clearTimeout(timer);
  }, [lockMs, reset]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const currentPassword = formText(event.currentTarget, "currentPassword");
    const newPassword = formText(event.currentTarget, "newPassword");
    const errors = {
      ...(!currentPassword && { current: "Nhập mật khẩu hiện tại." }),
      ...(newPasswordProblem(newPassword) && { next: newPasswordProblem(newPassword) ?? undefined }),
    };
    setLocal(errors);
    if (errors.current || errors.next) return;
    change.mutate({ currentPassword, newPassword });
  }

  const currentError = local.current ?? (code === "AUTH_INVALID_CREDENTIALS" ? "Mật khẩu hiện tại chưa đúng." : undefined);
  const nextError = local.next ?? (code === "AUTH_PASSWORD_POLICY_VIOLATION" ? PASSWORD_POLICY_TEXT : undefined);
  const at = retryAt(change.error);
  const banner =
    code === "AUTH_LOGIN_LOCKED"
      ? `Tạm khoá do nhập sai nhiều lần. Bạn thử lại sau ${at ?? "15 phút"}.`
      : code === "RATE_LIMITED"
        ? at
          ? `Bạn thao tác quá nhanh. Thử lại sau ${at}.`
          : "Bạn thao tác quá nhanh. Đợi một chút rồi thử lại."
        : change.isError && !currentError && !nextError
          ? change.error instanceof ApiError
            ? "Chưa đổi được mật khẩu. Bạn thử lại sau ít phút nhé."
            : "Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại."
          : null;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-content flex-col">
      <StepHeader back={{ href: "/account", label: "Quay lại tài khoản" }} />
      <main className="flex flex-1 flex-col gap-5 px-5 pb-6">
        <h1 className="font-display text-heading-lg text-balance">Đổi mật khẩu</h1>
        {!me.data ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <form className="grid gap-3.5" onSubmit={submit} aria-label="Đổi mật khẩu" noValidate>
            {banner ? (
              <p role="alert" className={cn("rounded-md px-3 py-2.5 text-body", isLocked(change.error) ? "bg-warning-soft text-warning" : "bg-danger-soft text-danger")}>
                {banner}
              </p>
            ) : null}
            <Field.Root>
              <Field.Label>Mật khẩu hiện tại</Field.Label>
              <Field.Input name="currentPassword" type="password" autoComplete="current-password" density="touch" />
              {currentError ? <Field.Error>{currentError}</Field.Error> : null}
            </Field.Root>
            <Field.Root>
              <Field.Label>Mật khẩu mới</Field.Label>
              <Field.Input name="newPassword" type="password" autoComplete="new-password" density="touch" />
              {nextError ? <Field.Error>{nextError}</Field.Error> : <Field.Hint>Ít nhất 8 ký tự. Tránh mật khẩu dễ đoán.</Field.Hint>}
            </Field.Root>
            <Button type="submit" block density="touch" busy={change.isPending} disabled={isLocked(change.error)}>
              Lưu mật khẩu
            </Button>
          </form>
        )}
        <Link
          href="/forgot-password"
          className={cn("inline-flex min-h-11 items-center self-center font-medium text-matcha-700 underline-offset-4 hover:underline", focusRing)}
        >
          Quên mật khẩu hiện tại?
        </Link>
      </main>
    </div>
  );
}
