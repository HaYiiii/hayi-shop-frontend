import type { ComponentProps } from "react";
import { cn } from "../cn.js";
import { Button, type ButtonProps } from "./button.js";

function Root({ className, ...props }: ComponentProps<"section">) {
  return (
    <section
      className={cn("grid justify-items-center gap-3 px-4 py-12 text-center", className)}
      {...props}
    />
  );
}

/** Frame for one official mascot illustration (mascot-empty / -success / -404); the app supplies the image. */
function Art({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("size-[200px] overflow-hidden rounded-lg bg-sunken *:size-full *:object-cover", className)}
      {...props}
    />
  );
}

function Title({ className, ...props }: ComponentProps<"h2">) {
  return <h2 className={cn("font-display text-heading-lg", className)} {...props} />;
}

function Body({ className, ...props }: ComponentProps<"p">) {
  return <p className={cn("max-w-[32ch] text-body-lg text-ink-muted", className)} {...props} />;
}

/** The one next step; a touch-size primary Button. */
function Action(props: ButtonProps) {
  return <Button density="touch" {...props} />;
}

/** Empty / success / not-found screen on Customer Web. Not for Backoffice, not for loading. */
export const EmptyState = { Root, Art, Title, Body, Action };
