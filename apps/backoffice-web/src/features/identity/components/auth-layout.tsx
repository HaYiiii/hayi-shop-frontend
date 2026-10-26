import { cn } from "@hayi/ui";
import type { ReactNode } from "react";

const widths = { narrow: "max-w-[400px]", default: "max-w-[440px]", medium: "max-w-[520px]", wide: "max-w-[720px]" };

/** Centred sign-in page on the cream ground (D3b screens 1–5). */
export function AuthLayout({ width = "narrow", children }: { width?: keyof typeof widths; children: ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-cream px-4 py-12">
      <div className={cn("flex w-full flex-col gap-6", widths[width])}>{children}</div>
    </main>
  );
}

export function Logo({ size }: { size: 48 | 56 | 64 | 96 }) {
  return <img src="/logo.webp" width={size} height={size} alt="HaYi Shop" fetchPriority="high" className="shrink-0" />;
}

export function AuthTitle({ children }: { children: ReactNode }) {
  return <h1 className="font-display text-heading-lg">{children}</h1>;
}
