/** Operational timezone default (Canonical §1.4). Branch responses also carry their own `timezone`. */
export const DEFAULT_BRANCH_TIMEZONE = "Asia/Ho_Chi_Minh";

/** Formats a UTC instant (ISO-8601 with Z) as local time HH:mm in the branch timezone. */
export function formatBranchTime(instant: string, timeZone: string = DEFAULT_BRANCH_TIMEZONE): string {
  return new Intl.DateTimeFormat("vi-VN", { timeZone, hour: "2-digit", minute: "2-digit", hour12: false }).format(
    new Date(instant),
  );
}

/** Formats a UTC instant as the local date dd/MM/yyyy in the branch timezone. */
export function formatBranchDate(instant: string, timeZone: string = DEFAULT_BRANCH_TIMEZONE): string {
  return new Intl.DateTimeFormat("vi-VN", { timeZone, day: "2-digit", month: "2-digit", year: "numeric" }).format(
    new Date(instant),
  );
}

/** Formats a calendar date (`yyyy-MM-dd`, no time or zone) as dd/MM/yyyy. */
export function formatIsoDate(date: string): string {
  return new Intl.DateTimeFormat("vi-VN", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" }).format(
    new Date(`${date}T00:00:00Z`),
  );
}

/** Formats a UTC instant as the local day and month dd/MM in the branch timezone. */
export function formatBranchDayMonth(instant: string, timeZone: string = DEFAULT_BRANCH_TIMEZONE): string {
  // vi-VN writes day and month alone as "06-11"; dates elsewhere use "/".
  const parts = new Intl.DateTimeFormat("vi-VN", { timeZone, day: "2-digit", month: "2-digit" }).formatToParts(
    new Date(instant),
  );
  const part = (type: "day" | "month") => parts.find((p) => p.type === type)?.value ?? "";
  return `${part("day")}/${part("month")}`;
}

/** Calendar days from today to the instant's date, both in the branch timezone (0 = today, 1 = tomorrow). */
export function branchDaysFromToday(
  instant: string,
  now: Date = new Date(),
  timeZone: string = DEFAULT_BRANCH_TIMEZONE,
): number {
  const day = (date: Date) => Date.parse(`${todayInBranch(date, timeZone)}T00:00:00Z`);
  return Math.round((day(new Date(instant)) - day(now)) / 86_400_000);
}

/** Today's calendar date (`yyyy-MM-dd`) in the branch timezone. */
export function todayInBranch(now: Date = new Date(), timeZone: string = DEFAULT_BRANCH_TIMEZONE): string {
  // en-CA formats dates as yyyy-MM-dd.
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
