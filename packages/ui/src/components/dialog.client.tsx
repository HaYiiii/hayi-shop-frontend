"use client";

import { Dialog as DialogPrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "../cn.js";
import { focusRing } from "./variants.js";

export const overlayClass =
  "fixed inset-0 z-50 bg-scrim";

/** Modal content centred on screen: focus trap, Esc to close, focus returns to the trigger. */
export function DialogContent({ className, children, ...props }: ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className={overlayClass} />
      <DialogPrimitive.Content
        className={cn(
          "fixed top-1/2 left-1/2 z-50 grid w-[min(calc(100%-32px),440px)] -translate-x-1/2 -translate-y-1/2 gap-4",
          "rounded-lg bg-paper p-5 text-ink shadow-overlay",
          focusRing,
          className,
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

/** A specific question: "Hủy đơn HY251012K7Q2M?". */
export function DialogTitle({ className, ...props }: ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title className={cn("text-title", className)} {...props} />;
}

/** The consequence of the decision (money, slot, refund). */
export function DialogDescription({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description className={cn("text-body text-ink-muted", className)} {...props} />
  );
}

/** Safe action first (left), primary/destructive action last (right). */
export function DialogActions({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex flex-wrap justify-end gap-2", className)} {...props} />;
}

export function DialogRoot(props: ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root {...props} />;
}

export function DialogTrigger(props: ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger {...props} />;
}

export function DialogClose(props: ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close {...props} />;
}
