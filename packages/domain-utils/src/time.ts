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
