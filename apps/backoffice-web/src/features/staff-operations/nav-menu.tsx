import type { ReactNode } from "react";
import { type NavItem, navGroups } from "./nav-items";

/** Classes for a menu link; `aria-current="page"` marks the open screen. */
export const navLinkClass =
  "flex min-h-10 items-center gap-3 rounded-md px-3 text-body font-medium text-ink-muted no-underline " +
  "hover:bg-sunken hover:text-ink aria-[current=page]:bg-matcha-100 aria-[current=page]:font-semibold " +
  "aria-[current=page]:text-matcha-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

interface NavMenuProps {
  /** Permissions in force for the current scope. Hiding is UX only; the API enforces (403). */
  permissions: ReadonlySet<string>;
  renderLink: (item: NavItem) => ReactNode;
}

export function NavMenu({ permissions, renderLink }: NavMenuProps) {
  const groups = navGroups
    .map((g) => ({ ...g, items: g.items.filter((item) => permissions.has(item.permission)) }))
    .filter((g) => g.items.length > 0);

  return (
    <nav aria-label="Điều hướng chính" className="flex flex-col gap-1 px-3 py-4">
      {groups.map((group, i) => (
        <section key={group.label} className="flex flex-col gap-1" aria-labelledby={`nav-group-${i}`}>
          <h2
            id={`nav-group-${i}`}
            className="px-3 pt-3 pb-2 text-caption font-semibold tracking-[0.06em] text-ink-subtle uppercase first:pt-1"
          >
            {group.label}
          </h2>
          <ul className="flex flex-col gap-1">
            {group.items.map((item) => (
              <li key={item.path}>{renderLink(item)}</li>
            ))}
          </ul>
        </section>
      ))}
      {groups.length === 0 ? (
        <p className="px-3 text-body text-ink-muted">
          Bạn chưa có quyền dùng màn nào ở phạm vi này. Chọn chi nhánh khác hoặc nhờ quản lý cấp quyền.
        </p>
      ) : null}
      <p className="mt-auto px-3 pt-3 text-caption text-ink-subtle">
        Menu chỉ hiện mục bạn có quyền ở phạm vi đang chọn.
      </p>
    </nav>
  );
}
