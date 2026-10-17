"use client";

import type { ComponentProps, MouseEvent } from "react";
import { cn } from "../cn.js";
import { focusRing } from "./variants.js";

/** Group of chips; always give it an `aria-label` ("Danh mục", "Khung giờ nhận"). */
export function ChipGroup({
  className,
  ...props
}: ComponentProps<"div"> & { "aria-label": string }) {
  return <div role="group" className={cn("flex flex-wrap gap-2", className)} {...props} />;
}

export type ChipProps = Omit<ComponentProps<"button">, "disabled"> & {
  pressed: boolean;
  /** Full or past slot: stays focusable, ignores activation. Put the reason in the label ("Đầy"). */
  unavailable?: boolean;
};

/** Pill toggle for category filters and pickup slots. */
export function Chip({ pressed, unavailable = false, className, onClick, ...props }: ChipProps) {
  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (unavailable) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  }

  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-disabled={unavailable || undefined}
      onClick={handleClick}
      className={cn(
        "inline-flex h-9 cursor-pointer items-center gap-2 rounded-pill border border-line-strong bg-paper px-4 text-body font-medium leading-none text-ink tabular-nums",
        "transition-colors duration-150 hover:bg-sunken",
        "aria-pressed:border-matcha-700 aria-pressed:bg-matcha-700 aria-pressed:text-on-primary",
        "aria-disabled:cursor-not-allowed aria-disabled:border-transparent aria-disabled:bg-sunken aria-disabled:text-ink-subtle aria-disabled:line-through",
        focusRing,
        className,
      )}
      {...props}
    />
  );
}
