import type { StatusBadgeTone } from "@hayi/ui";
import type { LifecycleCommand } from "./api/branches";
import type { BranchConflict, BranchStatus } from "./branch-form";

export const statusOrder: readonly BranchStatus[] = ["ACTIVE", "DRAFT", "INACTIVE", "CLOSED"];

export const statusLabel: Record<BranchStatus, string> = {
  DRAFT: "Nháp",
  ACTIVE: "Đang hoạt động",
  INACTIVE: "Tạm ngưng",
  CLOSED: "Đã đóng",
};

export const statusTone: Record<BranchStatus, StatusBadgeTone> = {
  DRAFT: "neutral",
  ACTIVE: "success",
  INACTIVE: "warning",
  CLOSED: "danger",
};

/** Commands offered in each status (Branch §4.3): CLOSED is terminal. */
export const lifecycleCommands: Record<BranchStatus, readonly LifecycleCommand[]> = {
  DRAFT: ["activate", "close"],
  ACTIVE: ["deactivate", "close"],
  INACTIVE: ["activate", "close"],
  CLOSED: [],
};

export const conflictCopy: Record<BranchConflict["type"], { title: string; detail: string }> = {
  ACTIVE_ORDERS: { title: "Đơn đang xử lý", detail: "Chờ xác nhận, đang pha hoặc chờ khách lấy" },
  FUTURE_SCHEDULED_ORDERS: { title: "Đơn hẹn ngày sau", detail: "Cần huỷ và hoàn tiền, hoặc chờ hoàn tất" },
  OPEN_GROUP_SESSIONS: { title: "Phiên đặt nhóm đang mở", detail: "Chủ nhóm chưa chốt đơn" },
};
