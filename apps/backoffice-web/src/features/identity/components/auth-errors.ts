import { ApiError } from "@hayi/api-client";
import { formatBranchTime } from "@hayi/domain-utils";

/** Local time (HH:mm) when a `429 AUTH_LOGIN_LOCKED` / `RATE_LIMITED` ends, from `Retry-After`. */
export function retryAt(error: ApiError): string | null {
  const seconds = error.problem.retryAfterSeconds;
  if (typeof seconds !== "number") return null;
  return formatBranchTime(new Date(Date.now() + seconds * 1000).toISOString());
}

export function isLocked(error: unknown): error is ApiError {
  return error instanceof ApiError && (error.code === "AUTH_LOGIN_LOCKED" || error.code === "RATE_LIMITED");
}

/** Copy for errors any sign-in step can meet; branch on `code`, never on the message. */
export function commonAuthMessage(error: unknown): string {
  if (isLocked(error)) {
    const at = retryAt(error);
    return error.code === "AUTH_LOGIN_LOCKED"
      ? `Tài khoản tạm khóa do nhập sai nhiều lần. ${at ? `Bạn thử lại sau ${at}` : "Bạn thử lại sau 15 phút"}, hoặc nhờ quản lý chi nhánh đặt lại mật khẩu.`
      : `Bạn thao tác quá nhanh. ${at ? `Thử lại sau ${at}.` : "Đợi một chút rồi thử lại."}`;
  }
  if (error instanceof ApiError && error.status >= 500) {
    return "Hệ thống đang bận. Bạn thử lại sau ít phút.";
  }
  if (!(error instanceof ApiError)) {
    return "Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.";
  }
  return "Có lỗi khi đăng nhập. Bạn thử lại nhé.";
}
