import { type VariantProps, cva } from "class-variance-authority";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "../cn.js";

const badgeVariants = cva(
  "inline-flex items-center gap-1 whitespace-nowrap rounded-sm px-2 py-0.5 text-caption leading-[18px] font-medium",
  {
    variants: {
      tone: {
        neutral: "bg-sunken text-ink-muted",
        brand: "bg-matcha-100 text-matcha-700",
        promo: "bg-houjicha-100 text-houjicha-700",
        success: "bg-success-soft text-success",
        warning: "bg-warning-soft text-warning",
        danger: "bg-danger-soft text-danger",
        info: "bg-info-soft text-info",
      },
    },
  },
);

export type StatusBadgeTone = NonNullable<VariantProps<typeof badgeVariants>["tone"]>;

export type StatusBadgeProps = Omit<ComponentProps<"span">, "children"> & {
  tone: StatusBadgeTone;
  /** Always a text label (from domain-utils enum labels); never colour alone. */
  children: ReactNode;
  dot?: boolean;
};

/** Short status label for orders, payments and stock. Order and payment status are separate badges. */
export function StatusBadge({ tone, dot = false, className, children, ...props }: StatusBadgeProps) {
  return (
    <span className={cn(badgeVariants({ tone }), className)} {...props}>
      {dot ? <span aria-hidden="true" className="size-1.5 rounded-pill bg-current" /> : null}
      {children}
    </span>
  );
}
