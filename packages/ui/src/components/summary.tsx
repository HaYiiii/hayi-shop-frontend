import type { ComponentProps } from "react";
import { cn } from "../cn.js";

/**
 * Facts about the whole object under the page title (lifecycle, where it is sold, last change), instead of
 * a narrow side column (D2 "Bố cục trang"). Items are separated by a thin rule.
 */
function SummaryRoot({ className, children, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="summary"
      className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 text-label font-normal text-ink-muted", className)}
      {...props}
    >
      {children}
    </div>
  );
}

function SummaryItem({ className, ...props }: ComponentProps<"span">) {
  return <span data-slot="summary-item" className={cn("min-w-0", className)} {...props} />;
}

interface Step {
  key: string;
  label: string;
  /** Arrow drawn after this step (default "→"). */
  connector?: string;
}

interface SummaryStepsProps extends Omit<ComponentProps<"ol">, "children"> {
  /** Accessible name of the list, e.g. "Vòng đời". */
  label: string;
  steps: readonly Step[];
  current: string;
}

/** Lifecycle steps; the current one is `aria-current="step"`, arrows are decorative. */
function SummarySteps({ label, steps, current, className, ...props }: SummaryStepsProps) {
  return (
    <ol
      aria-label={label}
      data-slot="summary-item"
      className={cn("m-0 flex list-none flex-wrap items-center gap-2 p-0 font-medium", className)}
      {...props}
    >
      {steps.map((step, i) => (
        <li key={step.key} className="flex items-center gap-2">
          <span
            aria-current={step.key === current ? "step" : undefined}
            className="aria-[current=step]:font-semibold aria-[current=step]:text-ink"
          >
            {step.label}
          </span>
          {i < steps.length - 1 ? (
            <span data-slot="summary-connector" aria-hidden="true">
              {step.connector ?? "→"}
            </span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

export const Summary = { Root: SummaryRoot, Item: SummaryItem, Steps: SummarySteps };
