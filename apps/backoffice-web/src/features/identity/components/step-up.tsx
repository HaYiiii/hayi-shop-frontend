import { Button, Dialog, Field } from "@hayi/ui";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { type FormEvent, useSyncExternalStore } from "react";
import { errorCode, unwrap, useApi } from "../../../lib/api";
import { formText } from "../../../lib/form";
import { meQuery } from "../api/session";
import type { StepUpGate } from "../api/step-up-gate";
import { commonAuthMessage } from "./auth-errors";
import { FormAlert } from "../../../lib/form-alert";
import { OtpInput } from "./otp-input";

/** Re-authentication for actions marked S (API 01-security §8). */
export function StepUpDialog({ gate }: { gate: StepUpGate }) {
  const open = useSyncExternalStore(gate.subscribe, gate.isOpen);
  return (
    <Dialog.Root open={open} onOpenChange={(next) => (next ? null : gate.settle("cancelled"))}>
      {open ? <StepUpForm gate={gate} /> : null}
    </Dialog.Root>
  );
}

function StepUpForm({ gate }: { gate: StepUpGate }) {
  const api = useApi();
  // Already loaded by the signed-in route: a step-up only comes from a signed-in action.
  const { data: me } = useSuspenseQuery(meQuery(api));
  // With MFA the code, without it the password (API 01-security §8, Decision L7); no switching between them.
  const method = me.mfaEnrolled ? "totp" : "password";
  const stepUp = useMutation({
    mutationFn: (body: { code: string } | { password: string }) => unwrap(api.POST("/auth/step-up", { body })),
    onSuccess: () => gate.settle("verified"),
    onError: (error) => {
      // The API client has already ended the session (Decision L7); give the 403 back to the action.
      if (errorCode(error) === "AUTH_SESSION_REVOKED") gate.settle("cancelled");
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = formText(event.currentTarget, "secret");
    stepUp.mutate(method === "totp" ? { code: value.replace(/\s/g, "") } : { password: value });
  }

  const code = errorCode(stepUp.error);
  const wrongSecret = code === "MFA_CODE_INVALID" || code === "AUTH_INVALID_CREDENTIALS";

  return (
    <Dialog.Content className="gap-4 p-6">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-pill bg-matcha-100 text-matcha-700">
          <svg viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
            <path d="M10 2.5 16 5v4.5c0 4-2.6 6.8-6 8-3.4-1.2-6-4-6-8V5l6-2.5Z" />
            <path d="m7.5 10 2 2 3.5-3.5" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </span>
        <div className="grid min-w-0 gap-1">
          <Dialog.Title>Xác thực lại để tiếp tục</Dialog.Title>
          <Dialog.Description>
            Đây là thao tác nhạy cảm. Sau khi xác thực, bạn không phải nhập lại trong 5 phút.
          </Dialog.Description>
        </div>
      </div>

      <form className="grid gap-4" onSubmit={submit}>
        {stepUp.isError && !wrongSecret ? <FormAlert tone="danger">{commonAuthMessage(stepUp.error)}</FormAlert> : null}
        <Field.Root>
          {method === "totp" ? (
            <>
              <Field.Label>Mã từ ứng dụng xác thực</Field.Label>
              <OtpInput name="secret" autoFocus placeholder="6 số…" className="h-12 text-center" />
              {wrongSecret ? <Field.Error>Mã chưa đúng. Nhập mã đang hiển thị trong ứng dụng.</Field.Error> : null}
            </>
          ) : (
            <>
              <Field.Label>Mật khẩu của bạn</Field.Label>
              <Field.Input name="secret" type="password" autoComplete="current-password" required autoFocus />
              <Field.Hint>Tài khoản chưa bật xác thực 2 lớp nên dùng mật khẩu.</Field.Hint>
              {wrongSecret ? <Field.Error>Mật khẩu chưa đúng. Bạn nhập lại nhé.</Field.Error> : null}
            </>
          )}
        </Field.Root>
        <Dialog.Actions>
          <Dialog.Close asChild>
            <Button variant="ghost">Hủy</Button>
          </Dialog.Close>
          <Button type="submit" busy={stepUp.isPending}>
            Xác thực và tiếp tục
          </Button>
        </Dialog.Actions>
      </form>
    </Dialog.Content>
  );
}
