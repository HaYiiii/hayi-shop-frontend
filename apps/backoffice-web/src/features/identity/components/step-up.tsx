import { Button, Dialog, Field } from "@hayi/ui";
import { useMutation, useQuery } from "@tanstack/react-query";
import { type FormEvent, useState, useSyncExternalStore } from "react";
import { errorCode, unwrap, useApi } from "../../../lib/api";
import { meQuery } from "../api/session";
import type { StepUpGate } from "../api/step-up-gate";
import { commonAuthMessage } from "./auth-errors";
import { FormAlert } from "./form-alert";
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
  // Loaded by the signed-in route; the dialog only reads it.
  const { data: me } = useQuery({ ...meQuery(api), enabled: false });
  // MFA is mandatory for STORE roles (Decision D4) and users with MFA step up by TOTP only (L7):
  // a password attempt would only spend one of the 5 tries before the session is revoked.
  const passwordAllowed = me !== undefined && me.storeRoles.length === 0;
  const [method, setMethod] = useState<"totp" | "password">("totp");
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
    const value = String(new FormData(event.currentTarget).get("secret"));
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
        <Field.Root key={method}>
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
              {wrongSecret ? (
                <Field.Error>Mật khẩu chưa đúng. Bạn nhập lại nhé.</Field.Error>
              ) : (
                <Field.Hint>Dùng khi tài khoản chưa bật xác thực 2 lớp.</Field.Hint>
              )}
            </>
          )}
        </Field.Root>
        {passwordAllowed ? (
          <Button
            variant="link"
            className="justify-self-start"
            onClick={() => {
              setMethod((m) => (m === "totp" ? "password" : "totp"));
              stepUp.reset();
            }}
          >
            {method === "totp" ? "Chưa bật xác thực 2 lớp? Dùng mật khẩu" : "Dùng mã từ ứng dụng xác thực"}
          </Button>
        ) : null}
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
