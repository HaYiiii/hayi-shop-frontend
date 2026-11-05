import type { BackofficeComponents } from "@hayi/api-client";
import { todayInBranch } from "@hayi/domain-utils";
import { Card, Skeleton, cn } from "@hayi/ui";
import { useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { useApi } from "../../../lib/api";
import { dayLabels } from "../../branch/hours-form";
import { capacityQuery } from "../api/fulfillment";

type CapacitySlot = BackofficeComponents["schemas"]["CapacitySlot"];

/** "Thứ Năm 24/12" for a `yyyy-MM-dd` date. */
function dayTitle(date: string) {
  const day = new Date(`${date}T00:00:00Z`);
  const weekday = dayLabels[(day.getUTCDay() + 6) % 7];
  return `${weekday} ${date.slice(8, 10)}/${date.slice(5, 7)}`;
}

/** What a customer reads on a slot (D3b screen 13): few left, full and past cutoff are marked. */
function slotText(slot: CapacitySlot) {
  if (slot.status === "CUTOFF_PASSED") return `${slot.slotStart} · qua hạn chốt`;
  if (slot.status === "FULL") return `${slot.slotStart} · đầy`;
  if (slot.status === "NEARLY_FULL") {
    const left = slot.maxOrders === null ? null : slot.maxOrders - slot.usedOrders;
    return left === null ? `${slot.slotStart} · sắp đầy` : `${slot.slotStart} · còn ${left} chỗ`;
  }
  return slot.slotStart;
}

const struck = (slot: CapacitySlot) => slot.status === "CUTOFF_PASSED" || slot.status === "FULL" || slot.status === "CLOSED";

/** One day's slots from `GET /fulfillment/capacity` (Decision V1): the saved setup, as customers see it. */
export function SlotPreview({ branchId }: { branchId: string }) {
  const api = useApi();
  const dateId = useId();
  const [date, setDate] = useState(() => todayInBranch());
  const capacity = useQuery({ ...capacityQuery(api, branchId, date), enabled: /^\d{4}-\d{2}-\d{2}$/.test(date) });

  return (
    <Card aria-labelledby={`${dateId}-title`} className="gap-2.5 p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 id={`${dateId}-title`} className="text-body font-semibold">
          {`Xem trước ${date ? dayTitle(date) : ""} `}
          <span className="font-normal text-ink-muted">· khách thấy</span>
        </h2>
        <label htmlFor={dateId} className="sr-only">
          Ngày xem trước
        </label>
        <input
          id={dateId}
          type="date"
          autoComplete="off"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="ml-auto h-control-compact rounded-md border border-line-strong bg-paper px-2 text-body tabular-nums text-ink hover:border-ink-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        />
      </div>
      {capacity.isPending ? (
        <Skeleton className="h-8 w-full" />
      ) : capacity.isError ? (
        <p className="text-label font-normal text-danger">Chưa tải được khung giờ của ngày này. Bạn thử chọn lại ngày.</p>
      ) : capacity.data.slots.length === 0 ? (
        <p className="text-label font-normal text-ink-muted">Ngày này không nhận đơn lấy tại quầy.</p>
      ) : (
        <ul aria-label="Khung giờ khách thấy" className="flex flex-wrap gap-1.5">
          {capacity.data.slots.map((slot) => (
            <li
              key={slot.slotStart}
              className={cn(
                "inline-flex h-[30px] items-center rounded-pill border px-3 text-label tabular-nums",
                struck(slot) ? "border-transparent bg-sunken text-ink-subtle line-through" : "border-line-strong bg-paper text-ink",
              )}
            >
              {slotText(slot)}
            </li>
          ))}
        </ul>
      )}
      <p className="text-caption text-ink-muted">Theo cấu hình đã lưu. Khung đã qua hạn chốt hoặc đã đầy bị gạch.</p>
    </Card>
  );
}
