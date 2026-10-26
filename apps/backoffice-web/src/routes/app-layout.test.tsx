import { createBackofficeClient } from "@hayi/api-client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createMemoryHistory } from "@tanstack/react-router";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createStepUpGate } from "../features/identity/api/step-up-gate";
import { ApiProvider } from "../lib/api";
import { createAppRouter } from "../lib/router";
import type { Me } from "../lib/scope";
import { API_ORIGIN, fakeApi, json, problem } from "../test/fake-api";

const manager: Me = {
  userId: "u-manager",
  storeRoles: [],
  storePermissions: [],
  branches: [
    { branchId: "b-q1", roles: ["MANAGER"], permissions: ["ORDER_VIEW", "ORDER_PREPARE", "STAFF_VIEW"] },
    { branchId: "b-q3", roles: ["BARISTA"], permissions: ["ORDER_PREPARE"] },
  ],
};

const owner: Me = { userId: "u-owner", storeRoles: ["OWNER"], storePermissions: ["ORDER_VIEW", "STAFF_VIEW"], branches: [] };

function renderApp(me: Me | null, path: string) {
  fakeApi({ "GET /auth/me": () => (me ? json(me) : problem(401, "AUTH_REQUIRED")) });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const api = createBackofficeClient({ baseUrl: API_ORIGIN });
  const router = createAppRouter(
    { queryClient, api, stepUpGate: createStepUpGate() },
    createMemoryHistory({ initialEntries: [path] }),
  );
  render(
    <QueryClientProvider client={queryClient}>
      <ApiProvider client={api}>
        <RouterProvider router={router} />
      </ApiProvider>
    </QueryClientProvider>,
  );
  return { router, user: userEvent.setup() };
}

function nav() {
  return within(screen.getByRole("navigation", { name: "Điều hướng chính" }));
}

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("Signed-in layout — scope from the URL (SOURCE-STRUCTURE §3.1, Staff Operations §16.2)", () => {
  it("sends a visitor without a session to the login page", async () => {
    const { router } = renderApp(null, "/branches/b-q1/orders");

    expect(await screen.findByRole("heading", { name: "Đăng nhập Backoffice" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/login");
  });

  it("opens the first permitted screen of the default branch", async () => {
    const { router } = renderApp(manager, "/");

    expect(await screen.findByRole("heading", { level: 1, name: "Bảng đơn" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/branches/b-q1/orders");
    expect(nav().getByRole("link", { name: "Bảng đơn" })).toHaveAttribute("href", "/branches/b-q1/orders");
  });

  it("takes the scope from the branch in the URL", async () => {
    renderApp(manager, "/branches/b-q3/preparation");

    expect(await screen.findByRole("button", { name: /Phạm vi: Chi nhánh b-q3/ })).toBeInTheDocument();
    expect(nav().getAllByRole("link").map((a) => a.textContent)).toEqual(["Màn pha chế"]);
  });

  it("keeps the screen and changes the branch in the URL when switching", async () => {
    const { router, user } = renderApp(manager, "/branches/b-q1/preparation");

    await user.click(await screen.findByRole("button", { name: /Phạm vi: Chi nhánh b-q1/ }));
    await user.click(screen.getByRole("menuitemradio", { name: /b-q3/ }));

    await vi.waitFor(() => expect(router.state.location.pathname).toBe("/branches/b-q3/preparation"));
    expect(localStorage.getItem("hayi.backoffice.lastBranchId")).toBe("b-q3");
  });

  it("guards a screen the branch does not permit (UX only)", async () => {
    renderApp(manager, "/branches/b-q3/orders");

    expect(await screen.findByRole("heading", { level: 1, name: "Bảng đơn" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("không có quyền xem màn này");
  });

  it("starts a STORE-only Owner store-wide, on a store-level screen", async () => {
    const { router } = renderApp(owner, "/");

    expect(await screen.findByRole("heading", { level: 1, name: "Nhân sự" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/staff");
    expect(screen.getAllByText("Toàn hệ thống").length).toBeGreaterThan(0);
  });
});
