import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PermissionGuard } from "./permission-guard";
import { WorkspaceProvider } from "./workspace";

const me = { userId: "u-1", storeRoles: [], storePermissions: [], branches: [] };

function renderWith(permissions: string[]) {
  render(
    <WorkspaceProvider value={{ me, scope: { kind: "branch", branchId: "b-q1" }, permissions: new Set(permissions) }}>
      <PermissionGuard permission="ORDER_VIEW">
        <h1>Bảng đơn</h1>
      </PermissionGuard>
    </WorkspaceProvider>,
  );
}

describe("PermissionGuard — UX only; the API still answers 403", () => {
  it("shows the screen when the scope grants the permission", () => {
    renderWith(["ORDER_VIEW"]);
    expect(screen.getByRole("heading", { name: "Bảng đơn" })).toBeInTheDocument();
  });

  it("explains instead of showing the screen when it does not", () => {
    renderWith(["ORDER_PREPARE"]);
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("không có quyền xem màn này");
  });
});
