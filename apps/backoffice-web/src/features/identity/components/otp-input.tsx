import { Field, cn } from "@hayi/ui";
import type { ComponentProps } from "react";

/** 6-digit TOTP code inside a <Field.Root>; a space after the 3rd digit is accepted and stripped by the caller. */
export function OtpInput({ className, ...props }: ComponentProps<typeof Field.Input>) {
  return (
    <Field.Input
      inputMode="numeric"
      autoComplete="one-time-code"
      pattern="[0-9 ]{6,7}"
      maxLength={7}
      spellCheck={false}
      required
      className={cn("text-title tracking-widest tabular-nums", className)}
      {...props}
    />
  );
}
