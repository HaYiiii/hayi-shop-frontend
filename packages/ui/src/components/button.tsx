"use client";

import type { VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type { ComponentProps, MouseEvent } from "react";
import { cn } from "../cn.js";
import { buttonVariants } from "./variants.js";

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "size-4 shrink-0 rounded-pill border-2 border-current border-r-transparent motion-safe:animate-spin",
        className,
      )}
    />
  );
}

export type ButtonProps = ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    /** Render the single child element (e.g. a link) with button styling. */
    asChild?: boolean;
    /** Request in flight: sets aria-busy, shows a spinner and ignores clicks. End the label with "…". */
    busy?: boolean;
  };

export function Button({
  asChild = false,
  busy = false,
  variant,
  density,
  block,
  className,
  type,
  onClick,
  children,
  ...props
}: ButtonProps) {
  const classes = cn(buttonVariants({ variant, density, block }), className);

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (busy) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  }

  if (asChild) {
    return (
      <Slot.Root className={classes} aria-busy={busy || undefined} onClick={handleClick} {...props}>
        {children}
      </Slot.Root>
    );
  }

  return (
    <button
      type={type ?? "button"}
      className={classes}
      aria-busy={busy || undefined}
      onClick={handleClick}
      {...props}
    >
      {busy ? <Spinner /> : null}
      {children}
    </button>
  );
}
