import { Button } from "@hayi/ui";
import { useEffect, useState } from "react";

/** Copies text to the clipboard and confirms in place (announced politely). */
export function CopyButton({ text, label }: { text: string; label: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    if (state === "idle") return;
    const timer = setTimeout(() => setState("idle"), 2000);
    return () => clearTimeout(timer);
  }, [state]);

  return (
    <Button
      variant="outline"
      onClick={() =>
        navigator.clipboard.writeText(text).then(
          () => setState("copied"),
          () => setState("failed"),
        )
      }
    >
      <span aria-live="polite">{state === "copied" ? "Đã sao chép" : state === "failed" ? "Không sao chép được" : label}</span>
    </Button>
  );
}
