/**
 * Money in the API is an integer amount of VND (API Contract README §4).
 * Formatting only — never compute totals on the client (server is the source of truth).
 */
const vndFormatter = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

export function formatVnd(amount: number): string {
  if (!Number.isSafeInteger(amount)) {
    throw new RangeError(`VND amount must be a safe integer, got ${amount}`);
  }
  return vndFormatter.format(amount);
}
