import { Button, Dialog, Field } from "@hayi/ui";
import { useMutation } from "@tanstack/react-query";
import { type FormEvent, useEffect, useState, useSyncExternalStore } from "react";
import { errorCode, unwrap, useApi } from "../../api";
import { commonAuthMessage } from "./auth-errors";
import { FormAlert } from "./form-alert";

/**
 * Bridge between the API client's `onStepUpRequired` and the dialog. Concurrent requests that need
 * step-up share one prompt; resolving replays them, rejecting hands back their 403.
 */
export function createStepUpGate() {
  let pending: { promise: Promise<void>; resolve: () => void; reject: (reason: Error) => void } | null = null;
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) listener();
  };

  return {
    request(): Promise<void> {
      if (!pending) {
        let resolve!: () => void;
        let reject!: (reason: Error) => void;
        const promise = new Promise<void>((res, rej) => {
          resolve = res;
          reject = rej;
        });
        pending = { promise, resolve, reject };
        notify();
      }
      return pending.promise;
    },
    settle(outcome: "verified" | "cancelled") {
      if (!pending) return;
      if (outcome === "verified") pending.resolve();
      else pending.reject(new Error("Step-up cancelled"));
      pending = null;
      notify();
    },
    isOpen: () => pending !== null,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export type StepUpGate = ReturnType<typeof createStepUpGate>;

interface StepUpDialogProps {
  gate: StepUpGate;
  /** Too many failures revoke the session (Decision L7). */
  onSessionRevoked: () => void;
}

export function StepUpDialog({ gate, onSessionRevoked }: StepUpDialogProps) {
  const open = useSyncExternalStore(gate.subscribe, gate.isOpen);
  return (
    <Dialog.Root open={open} onOpenChange={(next) => (next ? null : gate.settle("cancelled"))}>
      {open ? <StepUpForm gate={gate} onSessionRevoked={onSessionRevoked} /> : null}
    </Dialog.Root>
  );
}

function StepUpForm({ gate, onSessionRevoked }: StepUpDialogProps) {
  const api = useApi();
  const [method, setMethod] = useState<"totp" | "password">("totp");
  const stepUp = useMutation({
    mutationFn: (body: { code: string } | { password: string }) => unwrap(api.POST("/auth/step-up", { body })),
    onSuccess: () => gate.settle("verified"),
  });

  const code = errorCode(stepUp.error);
  const revoked = code === "AUTH_SESSION_REVOKED";
  useEffect(() => {
    if (!revoked) return;
    gate.settle("cancelled");
    onSessionRevoked();
  }, [revoked, gate, onSessionRevoked]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = String(new FormData(event.currentTarget).get("secret"));
    stepUp.mutate(method === "totp" ? { code: value.replace(/\s/g, "") } : { password: value });
  }

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
        {stepUp.isError && !wrongSecret && !revoked ? <FormAlert tone="danger">{commonAuthMessage(stepUp.error)}</FormAlert> : null}
        <Field.Root key={method}>
          {method === "totp" ? (
            <>
              <Field.Label>Mã từ ứng dụng xác thực</Field.Label>
              <Field.Input
                name="secret"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9 ]{6,7}"
                maxLength={7}
                spellCheck={false}
                required
                autoFocus
                placeholder="6 số…"
                className="h-12 text-center text-[20px] tracking-[0.25em] tabular-nums"
              />
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
        <button
          type="button"
          className="cursor-pointer justify-self-start text-body font-medium text-matcha-700 underline-offset-2 hover:text-matcha-800 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          onClick={() => {
            setMethod((m) => (m === "totp" ? "password" : "totp"));
            stepUp.reset();
          }}
        >
          {method === "totp" ? "Chưa bật xác thực 2 lớp? Dùng mật khẩu" : "Dùng mã từ ứng dụng xác thực"}
        </button>
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
