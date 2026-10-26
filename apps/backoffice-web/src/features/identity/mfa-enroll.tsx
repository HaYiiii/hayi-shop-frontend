import { Button, Card, Field, Skeleton, SkeletonGroup } from "@hayi/ui";
import { useMutation, useQuery } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import type { FormEvent, ReactNode } from "react";
import { errorCode, unwrap, useApi } from "../../api";
import { commonAuthMessage } from "./auth-errors";
import { AuthLayout, AuthTitle, Logo } from "./auth-layout";
import { CopyButton } from "./copy-button";
import { FormAlert } from "./form-alert";
import type { LoginNotice } from "./login-form";

interface MfaEnrollProps {
  enrollmentToken: string;
  onEnrolled: (recoveryCodes: string[]) => void;
  onRestart: (notice?: LoginNotice) => void;
}

/** "JBSWY3DPEHPK3PXP" → "JBSW Y3DP EHPK 3PXP", easier to type into an authenticator. */
function groupSecret(secret: string): string {
  return secret.match(/.{1,4}/g)?.join(" ") ?? secret;
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="grid size-7 shrink-0 place-items-center rounded-pill bg-matcha-100 text-label font-semibold text-matcha-700 tabular-nums">
        {n}
      </span>
      <div className="min-w-0">
        <p className="text-body font-semibold">{title}</p>
        <p className="text-label text-ink-muted">{children}</p>
      </div>
    </li>
  );
}

export function MfaEnroll({ enrollmentToken, onEnrolled, onRestart }: MfaEnrollProps) {
  const api = useApi();
  // A query (not an effect) so StrictMode's double mount cannot start two enrolments with different secrets.
  const setup = useQuery({
    queryKey: ["mfa-enroll", enrollmentToken],
    queryFn: () => unwrap(api.POST("/auth/mfa/enroll", { body: { enrollmentToken } })),
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const confirm = useMutation({
    mutationFn: (code: string) =>
      unwrap(api.POST("/auth/mfa/enroll/confirm", { body: { enrollmentToken, code } })),
    onSuccess: (result) => onEnrolled(result.recoveryCodes),
    onError: (error) => {
      if (errorCode(error) === "AUTH_REQUIRED") onRestart("challenge-expired");
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    confirm.mutate(String(new FormData(event.currentTarget).get("code")).replace(/\s/g, ""));
  }

  const wrongCode = errorCode(confirm.error) === "MFA_CODE_INVALID";

  return (
    <AuthLayout width="wide">
      <div className="flex flex-wrap items-center gap-4">
        <Logo size={56} />
        <div className="grid min-w-0 gap-1">
          <AuthTitle>Bật xác thực 2 lớp</AuthTitle>
          <p className="text-body text-ink-muted">
            Tài khoản có quyền Owner/Admin bắt buộc bật bước này trước khi vào Backoffice.
          </p>
        </div>
      </div>

      <Card className="grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-6 p-6">
        <ol className="flex flex-col gap-4">
          <Step n={1} title="Cài một ứng dụng xác thực">
            Ví dụ Google Authenticator, Microsoft Authenticator hoặc 1Password.
          </Step>
          <Step n={2} title="Quét mã QR">
            Không quét được? Nhập khóa bên dưới vào ứng dụng.
          </Step>
          <Step n={3} title="Nhập mã 6 số để xác nhận">
            Sau đó bạn nhận bộ mã khôi phục, chỉ hiển thị một lần.
          </Step>
        </ol>

        <div className="flex min-w-0 flex-col gap-4">
          {setup.isError ? (
            <FormAlert tone="danger">
              {errorCode(setup.error) === "AUTH_REQUIRED"
                ? "Phiên thiết lập đã hết hạn. Bạn đăng nhập lại để bắt đầu lại."
                : commonAuthMessage(setup.error)}
            </FormAlert>
          ) : null}
          {setup.data ? (
            <>
              <div
                role="img"
                aria-label="Mã QR thiết lập xác thực 2 lớp"
                className="self-center rounded-lg border border-line bg-paper p-3"
              >
                <QRCodeSVG value={setup.data.otpauthUri} size={152} marginSize={0} aria-hidden="true" />
              </div>
              <div className="grid gap-2">
                <span className="text-label" id="secret-label">
                  Khóa thiết lập
                </span>
                <div className="flex items-center gap-2">
                  <code
                    aria-labelledby="secret-label"
                    translate="no"
                    className="min-w-0 flex-1 rounded-md bg-sunken px-3 py-2.5 font-[ui-monospace,SFMono-Regular,Menlo,monospace] text-body font-medium tracking-[0.06em] [overflow-wrap:anywhere]"
                  >
                    {groupSecret(setup.data.secret)}
                  </code>
                  <CopyButton text={setup.data.secret} label="Sao chép" />
                </div>
              </div>
            </>
          ) : setup.isPending ? (
            <SkeletonGroup label="Đang tạo mã QR…" className="self-center">
              <Skeleton className="size-[176px] rounded-lg" />
            </SkeletonGroup>
          ) : null}

          <form className="grid gap-3" onSubmit={submit}>
            {confirm.isError && !wrongCode ? <FormAlert tone="danger">{commonAuthMessage(confirm.error)}</FormAlert> : null}
            <Field.Root>
              <Field.Label>Mã từ ứng dụng</Field.Label>
              <Field.Input
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9 ]{6,7}"
                maxLength={7}
                spellCheck={false}
                required
                placeholder="Ví dụ: 482913…"
                className="text-[18px] tracking-[0.2em] tabular-nums"
              />
              {wrongCode ? <Field.Error>Mã chưa đúng. Kiểm tra giờ trên điện thoại rồi nhập mã mới.</Field.Error> : null}
            </Field.Root>
            <Button type="submit" block busy={confirm.isPending} disabled={!setup.data}>
              Xác nhận và bật
            </Button>
          </form>
        </div>
      </Card>
    </AuthLayout>
  );
}
