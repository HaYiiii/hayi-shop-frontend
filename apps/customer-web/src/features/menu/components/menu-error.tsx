import { cn, focusRing } from "@hayi/ui";
import Link from "next/link";

/** The menu could not be loaded: what to do, by Problem `code` (API 02 §4); "Thử lại" reloads `retryHref`. */
export function MenuError({ code, retryHref }: { code: string; retryHref: string }) {
  const text =
    code === "RATE_LIMITED" ? "Bạn tải lại hơi nhanh. Chờ một chút rồi thử lại." : "Chưa tải được menu. Kiểm tra mạng rồi thử lại.";
  return (
    <div className="grid justify-items-start gap-3">
      <p role="alert" className="rounded-md bg-danger-soft px-3 py-2.5 text-body text-danger">
        {text}
      </p>
      <div className="flex flex-wrap gap-x-4">
        <Link
          href={retryHref}
          className={cn("inline-flex min-h-11 items-center text-body font-medium text-matcha-700 underline-offset-4 hover:underline", focusRing)}
        >
          Thử lại
        </Link>
        <Link
          href="/"
          className={cn("inline-flex min-h-11 items-center text-body font-medium text-matcha-700 underline-offset-4 hover:underline", focusRing)}
        >
          Chọn chi nhánh khác
        </Link>
      </div>
    </div>
  );
}
