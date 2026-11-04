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
import { aBranch } from "../features/branch/test/render-admin";
import { API_ORIGIN, fakeApi, json, problem } from "../test/fake-api";

const manager: Me = {
  userId: "u-manager",
  email: null, displayName: "Trần Minh", mfaEnrolled: false, storeRoles: [],
  storePermissions: [],
  branches: [
    { branchId: "b-q1", roles: ["MANAGER"], permissions: ["ORDER_VIEW", "ORDER_PREPARE", "STAFF_VIEW"] },
    { branchId: "b-q3", roles: ["BARISTA"], permissions: ["ORDER_PREPARE"] },
  ],
};

const owner: Me = { userId: "u-owner", email: "owner@hayi.vn", displayName: null, mfaEnrolled: true, storeRoles: ["OWNER"], storePermissions: ["ORDER_VIEW", "STAFF_VIEW"], branches: [] };

/** `GET /branches` in the caller's scope (API 09 §1.1); Võ Văn Tần is deactivated. */
const branches = [
  aBranch({ branchId: "b-q1", branchCode: "Q1-LELOI", name: "Quận 1 · Lê Lợi" }),
  aBranch({ branchId: "b-q3", branchCode: "Q3-VOVANTAN", name: "Quận 3 · Võ Văn Tần", status: "INACTIVE" }),
];

function renderApp(me: Me | null | (() => Response), path: string, branchList = () => json({ items: branches })) {
  const api = fakeApi({
    "GET /auth/me": () => (typeof me === "function" ? me() : me ? json(me) : problem(401, "AUTH_REQUIRED")),
    "GET /branches": branchList,
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const client = createBackofficeClient({ baseUrl: API_ORIGIN });
  const router = createAppRouter(
    { queryClient, api: client, stepUpGate: createStepUpGate() },
    createMemoryHistory({ initialEntries: [path] }),
  );
  render(
    <QueryClientProvider client={queryClient}>
      <ApiProvider client={client}>
        <RouterProvider router={router} />
      </ApiProvider>
    </QueryClientProvider>,
  );
  return { api, router, user: userEvent.setup() };
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

  it("keeps the session when /auth/me fails for another reason, and retries", async () => {
    let answer = () => problem(503, "SERVICE_UNAVAILABLE");
    const { router, user } = renderApp(() => answer(), "/branches/b-q1/orders");

    expect(await screen.findByRole("heading", { name: "Chưa tải được Backoffice" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/branches/b-q1/orders");

    answer = () => json(manager);
    await user.click(screen.getByRole("button", { name: "Thử lại" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Bảng đơn" })).toBeInTheDocument();
  });

  it.each([
    ["the display name", { displayName: "Trần Minh", email: "minh@hayi.vn" }, "Trần Minh"],
    ["the email without a display name", { displayName: null, email: "owner@hayi.vn" }, "owner@hayi.vn"],
    ["a generic label without either", { displayName: null, email: null }, "Tài khoản của bạn"],
  ])("shows %s on the account menu, from /auth/me", async (_, account, label) => {
    renderApp({ ...manager, ...account }, "/branches/b-q1/orders");

    expect(await screen.findByRole("button", { name: new RegExp(label) })).toBeInTheDocument();
  });

  it("opens the first permitted screen of the default branch", async () => {
    const { router } = renderApp(manager, "/");

    expect(await screen.findByRole("heading", { level: 1, name: "Bảng đơn" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/branches/b-q1/orders");
    expect(nav().getByRole("link", { name: "Bảng đơn" })).toHaveAttribute("href", "/branches/b-q1/orders");
  });

  it("takes the scope from the branch in the URL", async () => {
    renderApp(manager, "/branches/b-q3/preparation");

    expect(await screen.findByRole("button", { name: /Phạm vi: Quận 3 · Võ Văn Tần/ })).toBeInTheDocument();
    expect(nav().getAllByRole("link").map((a) => a.textContent)).toEqual(["Màn pha chế"]);
  });

  it("keeps the screen and changes the branch in the URL when switching", async () => {
    const { router, user } = renderApp(manager, "/branches/b-q1/preparation");

    await user.click(await screen.findByRole("button", { name: /Phạm vi: Quận 1 · Lê Lợi/ }));
    await user.click(screen.getByRole("menuitemradio", { name: /Quận 3 · Võ Văn Tần/ }));

    await vi.waitFor(() => expect(router.state.location.pathname).toBe("/branches/b-q3/preparation"));
    expect(localStorage.getItem("hayi.backoffice.lastBranchId")).toBe("b-q3");
  });

  it("names the Branch of the screen from GET /branches, never by its id", async () => {
    renderApp(manager, "/branches/b-q1/orders");

    expect(await screen.findByRole("heading", { level: 1, name: "Bảng đơn" })).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveTextContent("Quận 1 · Lê Lợi");
    expect(screen.queryByText(/b-q1/)).not.toBeInTheDocument();
  });

  it("names the Branch of a URL for a STORE-only Owner too, once the list is loaded", async () => {
    renderApp(owner, "/branches/b-q3/orders");

    expect(await screen.findByRole("heading", { level: 1, name: "Bảng đơn" })).toBeInTheDocument();
    expect(await within(screen.getByRole("main")).findByText("Quận 3 · Võ Văn Tần")).toBeInTheDocument();
  });

  it("keeps the app on its retry page when the Branch list of the user's Branches fails", async () => {
    renderApp(manager, "/branches/b-q1/orders", () => problem(503, "SERVICE_UNAVAILABLE"));

    expect(await screen.findByRole("heading", { name: "Chưa tải được Backoffice" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Thử lại" })).toBeInTheDocument();
  });

  it("says the Branch name could not be loaded for a STORE-only Owner, without blocking the screen", async () => {
    renderApp(owner, "/branches/b-q3/orders", () => problem(503, "SERVICE_UNAVAILABLE"));

    expect(await screen.findByRole("heading", { level: 1, name: "Bảng đơn" })).toBeInTheDocument();
    expect(await within(screen.getByRole("main")).findByText("Chưa tải được tên chi nhánh")).toBeInTheDocument();
    expect(screen.queryByText("Chi nhánh không xác định")).not.toBeInTheDocument();
  });

  it("does not ask for the Branch list when the account has no role anywhere", async () => {
    const { api } = renderApp({ ...manager, branches: [] }, "/");

    expect(await screen.findByRole("heading", { name: "Tài khoản chưa được giao chi nhánh" })).toBeInTheDocument();
    expect(api.calls.some((c) => c.route === "GET /branches")).toBe(false);
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
