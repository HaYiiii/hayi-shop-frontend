import { formatVnd } from "@hayi/domain-utils";
import { Button, StatusBadge } from "@hayi/ui";

export default function HomePage() {
  return (
    <main className="mx-auto grid max-w-content gap-4 px-4 py-12">
      <StatusBadge tone="brand" className="justify-self-start">
        Khung dự án P0.1
      </StatusBadge>
      <h1 className="font-display text-display-lg">HaYi Shop</h1>
      <p className="text-body-lg text-ink-muted">Chọn chi nhánh để xem menu và đặt trước.</p>
      <p className="text-caption text-ink-subtle">
        Ví dụ giá: <span className="tabular-nums">{formatVnd(45000)}</span>
      </p>
      <Button density="touch" block disabled aria-describedby="branch-hint">
        Chọn chi nhánh
      </Button>
      <p id="branch-hint" className="text-caption text-ink-subtle">
        Danh sách chi nhánh có ở bản cập nhật tiếp theo.
      </p>
    </main>
  );
}
