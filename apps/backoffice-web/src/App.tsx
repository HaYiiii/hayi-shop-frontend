import { formatVnd } from "@hayi/domain-utils";
import { Card, StatusBadge } from "@hayi/ui";

export function App() {
  return (
    <main className="mx-auto grid max-w-5xl gap-6 p-8">
      <h1 className="text-title">HaYi Backoffice</h1>
      <Card className="max-w-md">
        <StatusBadge tone="brand" className="justify-self-start">
          Khung dự án P0.1
        </StatusBadge>
        <p className="text-body text-ink-muted">Đăng nhập và Order Board sẽ có ở các slice tiếp theo.</p>
        <p className="text-caption text-ink-subtle">
          Ví dụ định dạng tiền: <span className="tabular-nums">{formatVnd(117000)}</span>
        </p>
      </Card>
    </main>
  );
}
