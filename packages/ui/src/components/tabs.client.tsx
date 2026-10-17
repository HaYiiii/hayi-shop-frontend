"use client";

import { Tabs as TabsPrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "../cn.js";
import { focusRing } from "./variants.js";

export function TabsList({ className, ...props }: ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn("flex gap-1 overflow-x-auto border-b border-line", className)}
      {...props}
    />
  );
}

export function TabsTab({ className, ...props }: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "inline-flex h-control-default cursor-pointer items-center gap-2 whitespace-nowrap border-b-2 border-transparent px-3 text-body font-medium leading-none text-ink-muted",
        "transition-colors duration-150 hover:text-ink",
        "aria-selected:border-matcha-700 aria-selected:font-semibold aria-selected:text-matcha-700",
        focusRing,
        className,
      )}
      {...props}
    />
  );
}

/** Live count inside a tab (e.g. orders per status). */
export function TabsCount({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      className={cn("rounded-pill bg-sunken px-2 text-caption tabular-nums text-ink-muted", className)}
      {...props}
    />
  );
}

export function TabsPanel({ className, ...props }: ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content className={cn(focusRing, className)} {...props} />;
}

export function TabsRoot(props: ComponentProps<typeof TabsPrimitive.Root>) {
  return <TabsPrimitive.Root {...props} />;
}
