import { cn } from "@hayi/ui";
import type { ReactNode } from "react";

const tones = {
  danger: "bg-danger-soft text-danger",
  warning: "bg-warning-soft text-warning",
  success: "bg-success-soft text-success",
} as const;

const icons: Record<keyof typeof tones, ReactNode> = {
  danger: (
    <>
      <circle cx="10" cy="10" r="8.5" />
      <path d="M10 5.5v5.5M10 13.8v.2" strokeWidth="1.8" />
    </>
  ),
  warning: (
    <>
      <rect x="4.5" y="9" width="11" height="8" rx="1.5" />
      <path d="M7 9V6.5a3 3 0 0 1 6 0V9" />
    </>
  ),
  success: <path d="M5 10.5l3 3 7-7" strokeWidth="1.8" />,
};

/** Message above a sign-in form: errors are `alert`, confirmations are `status`. */
export function FormAlert({ tone, children }: { tone: keyof typeof tones; children: ReactNode }) {
  return (
    <div
      role={tone === "success" ? "status" : "alert"}
      className={cn("flex items-start gap-2 rounded-md p-3 text-label font-medium", tones[tone])}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        className="mt-px size-[18px] shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {icons[tone]}
      </svg>
      <span>{children}</span>
    </div>
  );
}
