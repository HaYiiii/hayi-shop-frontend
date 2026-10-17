"use client";

import { type VariantProps, cva } from "class-variance-authority";
import { type ComponentProps, createContext, use, useEffect, useId, useState } from "react";
import { cn } from "../cn.js";
import { focusRing } from "./variants.js";

type FieldContextValue = {
  controlId: string;
  hintId: string;
  errorId: string;
  hasHint: boolean;
  hasError: boolean;
  setHasHint: (value: boolean) => void;
  setHasError: (value: boolean) => void;
};

const FieldContext = createContext<FieldContextValue | null>(null);

function useField(part: string) {
  const context = use(FieldContext);
  if (!context) throw new Error(`<Field.${part}> must be used inside <Field>`);
  return context;
}

export function FieldRoot({ className, ...props }: ComponentProps<"div">) {
  const id = useId();
  const [hasHint, setHasHint] = useState(false);
  const [hasError, setHasError] = useState(false);
  const value: FieldContextValue = {
    controlId: `${id}-control`,
    hintId: `${id}-hint`,
    errorId: `${id}-error`,
    hasHint,
    hasError,
    setHasHint,
    setHasError,
  };
  return (
    <FieldContext value={value}>
      <div className={cn("grid min-w-0 gap-2", className)} {...props} />
    </FieldContext>
  );
}

export function FieldLabel({ className, ...props }: ComponentProps<"label">) {
  const { controlId } = useField("Label");
  return <label htmlFor={controlId} className={cn("text-label text-ink", className)} {...props} />;
}

/** Props wiring a control to its label, hint and error. */
function useControlProps(part: string) {
  const { controlId, hintId, errorId, hasHint, hasError } = useField(part);
  const describedBy = [hasHint && hintId, hasError && errorId].filter(Boolean).join(" ");
  return {
    id: controlId,
    "aria-describedby": describedBy || undefined,
    "aria-invalid": hasError || undefined,
  };
}

const controlVariants = cva(
  [
    "w-full rounded-md border border-line-strong bg-paper px-3 text-ink leading-none",
    "transition-colors duration-150 hover:border-ink-muted",
    "aria-invalid:border-danger",
    "disabled:bg-sunken disabled:text-ink-subtle disabled:cursor-not-allowed",
    focusRing,
  ],
  {
    variants: {
      density: {
        default: "h-control-default text-body",
        // 16px text so iOS Safari does not zoom on focus.
        touch: "h-control-touch text-body-lg",
      },
    },
    defaultVariants: { density: "default" },
  },
);

type ControlVariants = VariantProps<typeof controlVariants>;

export function FieldInput({ className, density, ...props }: ComponentProps<"input"> & ControlVariants) {
  const controlProps = useControlProps("Input");
  return (
    <input
      className={cn(controlVariants({ density }), "placeholder:text-ink-subtle", className)}
      {...controlProps}
      {...props}
    />
  );
}

const chevron =
  "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='none' stroke='%235c5850' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 8 4 4 4-4'/%3E%3C/svg%3E\")] bg-size-[20px] bg-position-[right_8px_center] bg-no-repeat";

/** Native select: keyboard and screen-reader support for short lists (≤ 8 options). */
export function FieldSelect({ className, density, ...props }: ComponentProps<"select"> & ControlVariants) {
  const controlProps = useControlProps("Select");
  return (
    <select
      className={cn(controlVariants({ density }), "appearance-none pr-8", chevron, className)}
      {...controlProps}
      {...props}
    />
  );
}

export function FieldHint({ className, ...props }: ComponentProps<"p">) {
  const { hintId, setHasHint } = useField("Hint");
  useEffect(() => {
    setHasHint(true);
    return () => setHasHint(false);
  }, [setHasHint]);
  return <p id={hintId} className={cn("text-caption text-ink-subtle", className)} {...props} />;
}

/** Rendering an error marks the control invalid; say what happened and how to fix it. */
export function FieldError({ className, children, ...props }: ComponentProps<"p">) {
  const { errorId, setHasError } = useField("Error");
  useEffect(() => {
    setHasError(true);
    return () => setHasError(false);
  }, [setHasError]);
  return (
    <p
      id={errorId}
      className={cn("flex items-start gap-1 text-caption font-medium text-danger", className)}
      {...props}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        className="mt-0.5 size-3.5 shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      >
        <circle cx="10" cy="10" r="8.5" />
        <path d="M10 5.5v5.5M10 13.8v.2" />
      </svg>
      <span>{children}</span>
    </p>
  );
}
