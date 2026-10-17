import { cva } from "class-variance-authority";

/** Shared, server-safe class recipes (no "use client"). */
export const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

export const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md border border-transparent font-semibold leading-none cursor-pointer",
    "transition-colors duration-150",
    "disabled:bg-sunken disabled:text-ink-subtle disabled:border-transparent disabled:cursor-not-allowed",
    "aria-disabled:bg-sunken aria-disabled:text-ink-subtle aria-disabled:border-transparent aria-disabled:cursor-not-allowed",
    "aria-busy:cursor-progress",
    focusRing,
  ],
  {
    variants: {
      variant: {
        primary: "bg-matcha-700 text-on-primary hover:bg-matcha-800",
        secondary: "bg-matcha-100 text-matcha-700 hover:bg-matcha-50 hover:border-matcha-700",
        outline: "bg-paper text-ink border-line-strong hover:bg-sunken",
        ghost: "bg-transparent text-matcha-700 hover:bg-matcha-50",
        danger: "bg-danger text-on-primary",
      },
      density: {
        compact: "h-control-compact px-3 text-label",
        default: "h-control-default px-4 text-body",
        touch: "h-control-touch px-5 text-body-lg",
        barista: "h-control-barista px-6 text-barista-meta",
      },
      block: { true: "w-full" },
    },
    defaultVariants: { variant: "primary", density: "default" },
  },
);
