import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Teach tailwind-merge the D2 scales so e.g. `text-body-lg` is a font size, not a colour.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      color: [
        "cream", "paper", "sunken", "ink", "ink-muted", "ink-subtle", "line", "line-strong",
        "matcha-50", "matcha-100", "matcha-500", "matcha-700", "matcha-800",
        "houjicha-100", "houjicha-500", "houjicha-700", "on-primary",
        "success", "success-soft", "warning", "warning-soft", "danger", "danger-soft",
        "info", "info-soft", "focus", "scrim",
      ],
      font: ["sans", "display"],
      text: [
        "display-xl", "display-lg", "heading-lg", "title", "body-lg", "body",
        "label", "caption", "barista-item", "barista-meta",
      ],
      spacing: [
        "control-compact", "control-default", "control-touch", "control-barista",
        "row-compact", "row-comfortable",
      ],
      container: ["content"],
      radius: ["sm", "md", "lg", "pill"],
      shadow: ["overlay"],
    },
  },
});

/** Merge class names; later Tailwind utilities win over earlier conflicting ones. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
