import type { ComponentProps } from "react";
import { cn } from "../cn.js";

/** Loading region: busy and labelled ("Đang tải…"); its placeholder shapes are hidden from assistive tech. */
export function SkeletonGroup({
  label,
  className,
  children,
  ...props
}: ComponentProps<"div"> & { label: string }) {
  return (
    <div aria-busy="true" aria-label={label} className={className} {...props}>
      <div aria-hidden="true" className="contents">
        {children}
      </div>
    </div>
  );
}

/** Placeholder shaped like the real content; size it with utilities. */
export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("rounded-sm bg-sunken motion-safe:animate-hy-pulse", className)} {...props} />;
}
