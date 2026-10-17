"use client";

import { Dialog as DialogPrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "../cn.js";
import { overlayClass } from "./dialog.client.js";
import { focusRing } from "./variants.js";

/** Bottom sheet on phones, centred dialog from the `md` breakpoint. */
export function SheetContent({ className, children, ...props }: ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className={overlayClass} />
      <DialogPrimitive.Content
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 grid max-h-[85dvh] gap-4 overflow-y-auto overscroll-contain",
          "rounded-t-lg bg-paper px-4 pt-2 pb-[max(20px,env(safe-area-inset-bottom))] text-ink shadow-overlay",
          focusRing,
          "md:inset-x-auto md:bottom-auto md:top-1/2 md:left-1/2 md:w-[440px] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-lg md:p-5",
          className,
        )}
        {...props}
      >
        <div aria-hidden="true" className="h-1 w-10 justify-self-center rounded-pill bg-line md:hidden" />
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
