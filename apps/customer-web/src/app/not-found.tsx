import { cn, focusRing } from "@hayi/ui";
import Link from "next/link";

/** An unknown or closed Branch (and any other unknown page): lead back to the Branch choice. */
export default function NotFound() {
  return (
    <main className="mx-auto grid max-w-content justify-items-start gap-3 px-4 py-6">
      <h1 className="font-display text-heading-lg text-balance">Không tìm thấy trang này</h1>
      <p className="text-body text-ink-muted">Chi nhánh có thể đã ngưng nhận đơn, hoặc đường dẫn đã cũ.</p>
      <Link
        href="/"
        className={cn("inline-flex min-h-11 items-center text-body font-medium text-matcha-700 underline-offset-4 hover:underline", focusRing)}
      >
        Chọn chi nhánh
      </Link>
    </main>
  );
}
