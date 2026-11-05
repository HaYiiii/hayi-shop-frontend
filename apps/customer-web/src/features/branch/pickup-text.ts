import { branchDaysFromToday, formatBranchDayMonth, formatBranchTime } from "@hayi/domain-utils";

/**
 * `earliestPickupAt` in words (Decision N5, D3a screen 1): the earliest bookable slot in the next 7 days,
 * `null` when there is none. `today` marks a slot the customer can still get today.
 */
export function pickupText(earliestPickupAt: string | null, now: Date = new Date()): { text: string; today: boolean } {
  if (earliestPickupAt === null) return { text: "Hôm nay hết nhận đơn · chưa nhận đặt trước", today: false };
  const days = branchDaysFromToday(earliestPickupAt, now);
  if (days <= 0) return { text: `Lấy sớm nhất ${formatBranchTime(earliestPickupAt)} hôm nay`, today: true };
  if (days === 1) return { text: "Hôm nay hết nhận đơn · đặt trước cho ngày mai", today: false };
  return { text: `Hôm nay hết nhận đơn · đặt trước từ ${formatBranchDayMonth(earliestPickupAt)}`, today: false };
}
