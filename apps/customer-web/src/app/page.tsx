import { formatVnd } from "@hayi/domain-utils";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-2xl font-semibold">HaYi Shop</h1>
      <p className="mt-2 text-neutral-600">Chọn chi nhánh để xem menu và đặt trước.</p>
      <p className="mt-6 text-sm text-neutral-400">Khung dự án P0.1 · ví dụ giá: {formatVnd(45000)}</p>
    </main>
  );
}
