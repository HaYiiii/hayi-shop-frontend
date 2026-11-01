import type { ReactNode } from "react";
import type { Scope } from "../../../lib/scope";

interface NavItemBase {
  id: string;
  label: string;
  /** Shown when the current scope grants this permission (01-security.md §7). */
  permission: string;
  icon: ReactNode;
}

/** A screen of one Branch: its URL carries the Branch (SOURCE-STRUCTURE §3.1). */
export interface BranchNavItem extends NavItemBase {
  level: "branch";
  to:
    | "/branches/$branchId/orders"
    | "/branches/$branchId/preparation"
    | "/branches/$branchId/payments"
    | "/branches/$branchId/sold-out"
    | "/branches/$branchId/slots";
}

/** A screen outside any one Branch. */
export interface StoreNavItem extends NavItemBase {
  level: "store";
  to: "/staff";
}

export type NavItem = BranchNavItem | StoreNavItem;

export interface NavGroup {
  label: string;
  items: NavItem[];
}

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className="size-5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

/** Backoffice screens (D3b) and the permission each needs. */
export const navGroups: NavGroup[] = [
  {
    label: "Vận hành",
    items: [
      {
        id: "orders",
        level: "branch",
        to: "/branches/$branchId/orders",
        label: "Bảng đơn",
        permission: "ORDER_VIEW",
        icon: (
          <Icon>
            <rect x="3" y="3" width="6" height="14" rx="1.5" />
            <rect x="11" y="3" width="6" height="9" rx="1.5" />
          </Icon>
        ),
      },
      {
        id: "preparation",
        level: "branch",
        to: "/branches/$branchId/preparation",
        label: "Màn pha chế",
        permission: "ORDER_PREPARE",
        icon: (
          <Icon>
            <path d="M4 7h10v5a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V7Z" />
            <path d="M14 8.5h1.5a2 2 0 0 1 0 4H14" />
          </Icon>
        ),
      },
      {
        id: "payments",
        level: "branch",
        to: "/branches/$branchId/payments",
        label: "Duyệt thanh toán",
        permission: "PAYMENT_VERIFY",
        icon: (
          <Icon>
            <rect x="2.5" y="5" width="15" height="10" rx="1.5" />
            <path d="M2.5 8.5h15" />
          </Icon>
        ),
      },
      {
        id: "sold-out",
        level: "branch",
        to: "/branches/$branchId/sold-out",
        label: "Hết hàng",
        permission: "SOLD_OUT_MANAGE",
        icon: (
          <Icon>
            <circle cx="10" cy="10" r="7" />
            <path d="m5.5 14.5 9-9" />
          </Icon>
        ),
      },
    ],
  },
  {
    label: "Quản lý chi nhánh",
    items: [
      {
        id: "slots",
        level: "branch",
        to: "/branches/$branchId/slots",
        label: "Cấu hình khung giờ",
        permission: "FULFILLMENT_CONFIG_MANAGE",
        icon: (
          <Icon>
            <circle cx="10" cy="10" r="7" />
            <path d="M10 6v4l2.5 2" />
          </Icon>
        ),
      },
      {
        id: "staff",
        level: "store",
        to: "/staff",
        label: "Nhân sự",
        permission: "STAFF_VIEW",
        icon: (
          <Icon>
            <circle cx="8" cy="7" r="3" />
            <path d="M2.5 16.5a5.5 5.5 0 0 1 11 0M13.5 4.5a3 3 0 0 1 0 5.5M15.5 12a5 5 0 0 1 2 4.5" />
          </Icon>
        ),
      },
    ],
  },
];

export const navItems: NavItem[] = navGroups.flatMap((g) => g.items);

/** Branch screens need a Branch in scope; every screen needs its permission there. */
export function canOpen(item: NavItem, scope: Scope, permissions: ReadonlySet<string>): boolean {
  return (item.level === "store" || scope.kind === "branch") && permissions.has(item.permission);
}
