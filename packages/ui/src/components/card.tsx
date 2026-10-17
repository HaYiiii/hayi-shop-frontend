import type { ComponentProps } from "react";
import { cn } from "../cn.js";

/** Paper surface on the cream page: thin `line` border, no shadow. */
export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("grid min-w-0 gap-3 rounded-lg border border-line bg-paper p-4", className)}
      {...props}
    />
  );
}
