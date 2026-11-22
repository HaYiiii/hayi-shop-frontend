"use client";

import { ApiError } from "@hayi/api-client";
import { formatBranchTime } from "@hayi/domain-utils";
import { Button, Field, cn, focusRing } from "@hayi/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { errorCode, meKey, useCustomerApi } from "../../../lib/customer-api";
import { logIn, meQuery, safeNext } from "../api/session";

/** Local time (HH:mm, Branch time) when a `429` ends, from `Retry-After`. */
function retryAt(error: ApiError): string | null {
  const seconds = error.problem.retryAfterSeconds;
  return typeof seconds === "number" ? formatBranchTime(new Date(Date.now() + seconds * 1000).toISOString()) : null;
}

/** Copy per Problem `code` (API 01-security §6.1, §6.3); never the message text. */
export function loginErrorText(error: unknown): string {
  if (!(error instanceof ApiError)) return "Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.";
  const at = retryAt(error);
  switch (error.code) {
    case "AUTH_INVALID_CREDENTIALS":
      return "Số điện thoại hoặc mật khẩu chưa đúng.";
    case "AUTH_LOGIN_LOCKED":
      return `Đăng nhập tạm khoá do nhập sai nhiều lần. Bạn thử lại sau ${at ?? "15 phút"}.`;
    case "RATE_LIMITED":
      return at ? `Bạn thao tác quá nhanh. Thử lại sau ${at}.` : "Bạn thao tác quá nhanh. Đợi một chút rồi thử lại.";
    case "LOGIN_VERIFICATION_REQUIRED":
      return "Cần xác minh thêm để đăng nhập. Bạn thử lại sau ít phút nhé.";
    default:
      return error.status >= 500 ? "Hệ thống đang bận. Bạn thử lại sau ít phút." : "Chưa đăng nhập được. Bạn thử lại nhé.";
  }
}

const isLocked = (error: unknown) => errorCode(error) === "AUTH_LOGIN_LOCKED" || errorCode(error) === "RATE_LIMITED";

/** D3a screen 8, sign-in step: phone + password, then back to the page the Customer came from. */
export function LoginScreen({ next }: { next?: string | undefined }) {
  const api = useCustomerApi();
  const queryClient = useQueryClient();
  const router = useRouter();
  const login = useMutation({
    mutationFn: async (body: { phone: string; password: string }) => {
      const result = await logIn(api, body);
      // `202 verificationRequired` is reserved for a risk engine (Decision AO1); no flow for it yet.
      if (result.verificationRequired) throw new ApiError({ status: 202, code: "LOGIN_VERIFICATION_REQUIRED" });
    },
    onSuccess: async () => {
      // Load the signed-in Customer before leaving, so the next page never sees the cached "signed out".
      await queryClient.fetchQuery({ ...meQuery(api), staleTime: 0 }).catch(() => queryClient.removeQueries({ queryKey: meKey }));
      router.replace(safeNext(next));
    },
  });

  // A lock ends on its own: clear the error then, so the button works again.
  const lockMs = isLocked(login.error) && login.error instanceof ApiError ? Number(login.error.problem.retryAfterSeconds ?? 0) * 1000 : 0;
  const { reset } = login;
  useEffect(() => {
    if (!lockMs) return;
    const timer = setTimeout(reset, lockMs);
    return () => clearTimeout(timer);
  }, [lockMs, reset]);

  const [missing, setMissing] = useState<{ phone?: string; password?: string }>({});

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const text = (name: string) => {
      const value = form.get(name);
      return typeof value === "string" ? value : "";
    };
    const phone = text("phone").replace(/[\s.-]/g, "");
    const password = text("password");
    // Checked here: an empty field would only come back as AUTH_INVALID_CREDENTIALS.
    const local = { ...(!phone && { phone: "Nhập số điện thoại." }), ...(!password && { password: "Nhập mật khẩu." }) };
    setMissing(local);
    if (local.phone || local.password) {
      formElement.querySelector<HTMLInputElement>(`[name="${local.phone ? "phone" : "password"}"]`)?.focus();
      return;
    }
    login.mutate({ phone, password });
  }

  const wrong = errorCode(login.error) === "AUTH_INVALID_CREDENTIALS";

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-content flex-col">
      <header className="flex items-center px-1 py-2">
        <Link
          href={safeNext(next, "/")}
          aria-label="Đóng"
          className={cn("grid size-11 place-items-center rounded-md text-ink", focusRing)}
        >
          <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="m5 5 10 10M15 5 5 15" />
          </svg>
        </Link>
      </header>

      <main className="flex flex-1 flex-col gap-5 px-5 pb-6">
        <Image src="/logo.webp" alt="HaYi Shop" width={88} height={88} priority className="size-22 self-center" />
        <div className="grid gap-1.5 text-center">
          <h1 className="font-display text-heading-lg text-balance">Chào bạn trở lại</h1>
          <p className="text-body text-ink-muted">Đăng nhập để xem đơn và tích điểm.</p>
        </div>

        <form className="grid gap-3.5" onSubmit={submit} aria-label="Đăng nhập" noValidate>
          {login.isError ? (
            <p role="alert" className={cn("rounded-md px-3 py-2.5 text-body", isLocked(login.error) ? "bg-warning-soft text-warning" : "bg-danger-soft text-danger")}>
              {loginErrorText(login.error)}
            </p>
          ) : null}
          <Field.Root>
            <Field.Label>Số điện thoại</Field.Label>
            <Field.Input
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              density="touch"
              required
              placeholder="Ví dụ: 0901 234 567…"
              className="tabular-nums"
            />
            {missing.phone ? <Field.Error>{missing.phone}</Field.Error> : null}
          </Field.Root>
          <Field.Root>
            <Field.Label>Mật khẩu</Field.Label>
            <Field.Input name="password" type="password" autoComplete="current-password" density="touch" required aria-invalid={wrong || undefined} />
            {missing.password ? <Field.Error>{missing.password}</Field.Error> : null}
          </Field.Root>
          <Button type="submit" block density="touch" busy={login.isPending} disabled={isLocked(login.error)}>
            Đăng nhập
          </Button>
        </form>
      </main>
    </div>
  );
}
