import { formatVnd } from "@hayi/domain-utils";

export function App() {
  return (
    <main className="mx-auto max-w-5xl p-8">
      <h1 className="text-2xl font-semibold">HaYi Backoffice</h1>
      <p className="mt-2 text-neutral-600">Khung dự án P0.1 — đăng nhập và Order Board sẽ có ở các slice tiếp theo.</p>
      <p className="mt-6 text-sm text-neutral-400">Ví dụ định dạng tiền: {formatVnd(117000)}</p>
    </main>
  );
}
