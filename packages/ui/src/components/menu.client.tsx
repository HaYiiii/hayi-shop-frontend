"use client";

import { DropdownMenu } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "../cn.js";
import { focusRing } from "./variants.js";

export function MenuRoot(props: ComponentProps<typeof DropdownMenu.Root>) {
  return <DropdownMenu.Root {...props} />;
}

/** The opening button: 40px, `line-strong` border, chevron. Pass `asChild` to use your own button. */
export function MenuTrigger({ className, children, asChild, ...props }: ComponentProps<typeof DropdownMenu.Trigger>) {
  if (asChild) return <DropdownMenu.Trigger asChild {...props}>{children}</DropdownMenu.Trigger>;
  return (
    <DropdownMenu.Trigger
      className={cn(
        "inline-flex h-control-default cursor-pointer items-center gap-2.5 rounded-md border border-line-strong bg-paper px-3",
        "text-body font-medium text-ink hover:bg-sunken",
        focusRing,
        className,
      )}
      {...props}
    >
      {children}
      <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="m5 7.5 5 5 5-5" />
      </svg>
    </DropdownMenu.Trigger>
  );
}

/** Popover panel: paper, `line` border, overlay shadow; keyboard and focus handled by Radix. */
export function MenuContent({ className, sideOffset = 8, align = "start", ...props }: ComponentProps<typeof DropdownMenu.Content>) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        sideOffset={sideOffset}
        align={align}
        className={cn(
          "z-50 flex w-[min(calc(100vw-32px),360px)] flex-col gap-0.5 rounded-lg border border-line bg-paper p-2 text-ink shadow-overlay",
          className,
        )}
        {...props}
      />
    </DropdownMenu.Portal>
  );
}

export function MenuLabel({ className, ...props }: ComponentProps<typeof DropdownMenu.Label>) {
  return (
    <DropdownMenu.Label
      className={cn("px-3 pt-2 pb-1 text-caption font-semibold tracking-[0.06em] text-ink-subtle uppercase", className)}
      {...props}
    />
  );
}

const itemClass =
  "flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-left text-body outline-none " +
  "data-highlighted:bg-sunken data-[state=checked]:bg-matcha-50 data-disabled:cursor-not-allowed data-disabled:text-ink-subtle " +
  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus";

function ItemText({ children, description }: { children: ReactNode; description?: ReactNode }) {
  return (
    <span className="min-w-0 flex-1">
      <span className="block font-medium in-data-[state=checked]:font-semibold">{children}</span>
      {description ? <span className="block text-caption text-ink-muted">{description}</span> : null}
    </span>
  );
}

export function MenuItem({ className, ...props }: ComponentProps<typeof DropdownMenu.Item>) {
  return <DropdownMenu.Item className={cn(itemClass, "min-h-10 font-medium", className)} {...props} />;
}

export function MenuRadioGroup(props: ComponentProps<typeof DropdownMenu.RadioGroup>) {
  return <DropdownMenu.RadioGroup className="flex flex-col gap-0.5" {...props} />;
}

/** One choice with an optional second line (role, status); a check marks the current one. */
export function MenuRadioItem({
  className,
  children,
  description,
  ...props
}: ComponentProps<typeof DropdownMenu.RadioItem> & { description?: ReactNode }) {
  return (
    <DropdownMenu.RadioItem className={cn(itemClass, className)} {...props}>
      <ItemText description={description}>{children}</ItemText>
      <DropdownMenu.ItemIndicator className="text-matcha-700">
        <svg aria-hidden="true" viewBox="0 0 20 20" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 10.5l3 3 7-7" />
        </svg>
      </DropdownMenu.ItemIndicator>
    </DropdownMenu.RadioItem>
  );
}

export function MenuSeparator({ className, ...props }: ComponentProps<typeof DropdownMenu.Separator>) {
  return <DropdownMenu.Separator className={cn("my-1 h-px bg-line", className)} {...props} />;
}
