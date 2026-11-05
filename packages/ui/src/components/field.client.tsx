"use client";

import { type VariantProps, cva } from "class-variance-authority";
import { type ComponentProps, createContext, use, useEffect, useId, useMemo, useState } from "react";
import { Slot } from "radix-ui";
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

type FieldRootProps = ComponentProps<"div"> & {
  /** Inside a `Field.Group`: take the whole row. */
  span?: "full";
};

export function FieldRoot({ className, span, ...props }: FieldRootProps) {
  const id = useId();
  const [hasHint, setHasHint] = useState(false);
  const [hasError, setHasError] = useState(false);
  const value = useMemo<FieldContextValue>(
    () => ({
      controlId: `${id}-control`,
      hintId: `${id}-hint`,
      errorId: `${id}-error`,
      hasHint,
      hasError,
      setHasHint,
      setHasError,
    }),
    [id, hasHint, hasError],
  );
  return (
    <FieldContext value={value}>
      <div data-slot="field" data-span={span} className={cn("grid min-w-0 content-start gap-2", className)} {...props} />
    </FieldContext>
  );
}

export function FieldLabel({ className, ...props }: ComponentProps<"label">) {
  const { controlId } = useField("Label");
  return <label data-slot="field-label" htmlFor={controlId} className={cn("text-label text-ink", className)} {...props} />;
}

/** A control together with its unit or button ("phút", "₫"): the block lines up as the control. */
export function FieldControl({ className, ...props }: ComponentProps<"div">) {
  useField("Control");
  return <div data-slot="field-control" className={cn("flex min-w-0 items-center gap-2", className)} {...props} />;
}

type FieldGroupProps = ComponentProps<"div"> & {
  /** Use the child element (e.g. a `<fieldset>` with its `<legend>`) as the group. */
  asChild?: boolean;
  /** Columns of the grid layout (default 2); one column below 600px. */
  columns?: number;
  /** `horizontal`: label column on the left, for settings panels. */
  orientation?: "grid" | "horizontal";
  /** Width of the label column in the horizontal layout (default 200px). */
  labelWidth?: string;
};

/**
 * Fields laid out together so label, control and message of a row share tracks (D2 "Bố cục form"): a label
 * that wraps or a message under one field never shifts the controls next to it, and the message line is
 * kept so an error does not make the form jump. Layout CSS lives in styles.css (`[data-slot=field-group]`).
 */
export function FieldGroup({ asChild = false, columns, orientation = "grid", labelWidth, className, style, ...props }: FieldGroupProps) {
  const Comp = asChild ? Slot.Root : "div";
  const vars: Record<string, string> = {};
  if (columns) vars["--hy-fields-cols"] = String(columns);
  if (labelWidth) vars["--hy-label-w"] = labelWidth;
  return (
    <Comp
      data-slot="field-group"
      data-orientation={orientation}
      className={cn("m-0 min-w-0 border-0 p-0", className)}
      style={{ ...vars, ...style }}
      {...props}
    />
  );
}

type CallerAria = { "aria-describedby"?: string | undefined; "aria-invalid"?: ComponentProps<"input">["aria-invalid"] };

/**
 * Props wiring a control to its label, hint and error. The caller's own aria-describedby is kept
 * first and its aria-invalid is kept unless a rendered <Field.Error> already marks the control invalid.
 */
function useControlProps(part: string, caller: CallerAria) {
  const { controlId, hintId, errorId, hasHint, hasError } = useField(part);
  // One message slot: an error replaces the hint.
  const describedBy = [caller["aria-describedby"], hasHint && !hasError && hintId, hasError && errorId]
    .filter(Boolean)
    .join(" ");
  return {
    id: controlId,
    "aria-describedby": describedBy || undefined,
    "aria-invalid": hasError || caller["aria-invalid"] || undefined,
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
/** The control's `id` is owned by Field (it links the label), so callers cannot set it. */
type ControlProps<T extends "input" | "select"> = Omit<ComponentProps<T>, "id"> & ControlVariants;

export function FieldInput({
  className,
  density,
  "aria-describedby": describedBy,
  "aria-invalid": invalid,
  ...props
}: ControlProps<"input">) {
  const controlProps = useControlProps("Input", { "aria-describedby": describedBy, "aria-invalid": invalid });
  return (
    <input
      className={cn(controlVariants({ density }), "placeholder:text-ink-subtle", className)}
      {...props}
      {...controlProps}
    />
  );
}

const chevron =
  "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='none' stroke='%235c5850' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 8 4 4 4-4'/%3E%3C/svg%3E\")] bg-size-[20px] bg-position-[right_8px_center] bg-no-repeat";

/** Native select: keyboard and screen-reader support for short lists (≤ 8 options). */
export function FieldSelect({
  className,
  density,
  "aria-describedby": describedBy,
  "aria-invalid": invalid,
  ...props
}: ControlProps<"select">) {
  const controlProps = useControlProps("Select", { "aria-describedby": describedBy, "aria-invalid": invalid });
  return (
    <select
      className={cn(controlVariants({ density }), "appearance-none pr-8", chevron, className)}
      {...props}
      {...controlProps}
    />
  );
}

/** Hidden while a `<Field.Error>` is rendered: hint and error share one message slot. */
export function FieldHint({ className, ...props }: ComponentProps<"p">) {
  const { hintId, hasError, setHasHint } = useField("Hint");
  useEffect(() => {
    setHasHint(true);
    return () => setHasHint(false);
  }, [setHasHint]);
  return (
    <p
      data-slot="field-message"
      id={hintId}
      hidden={hasError}
      className={cn("text-caption text-ink-subtle", className)}
      {...props}
    />
  );
}

const errorIcon = (
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
);

/** Rendering an error marks the control invalid; say what happened and how to fix it. */
export function FieldError({ className, children, ...props }: ComponentProps<"p">) {
  const { errorId, setHasError } = useField("Error");
  useEffect(() => {
    setHasError(true);
    return () => setHasError(false);
  }, [setHasError]);
  return (
    <p
      data-slot="field-message"
      id={errorId}
      className={cn("flex items-start gap-1 text-caption font-medium text-danger", className)}
      {...props}
    >
      {errorIcon}
      <span>{children}</span>
    </p>
  );
}
