import { createBackofficeClient } from "@hayi/api-client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createMemoryHistory } from "@tanstack/react-router";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createStepUpGate } from "../../identity/api/step-up-gate";
import { ApiProvider } from "../../../lib/api";
import { createAppRouter } from "../../../lib/router";
import type { Me } from "../../../lib/scope";
import { API_ORIGIN, fakeApi, json } from "../../../test/fake-api";
import type { Branch } from "../branch-form";

type Handlers = Parameters<typeof fakeApi>[0];

export const owner: Me = {
  userId: "u-owner",
  email: "owner@hayi.vn",
  displayName: "Ngọc Hà",
  mfaEnrolled: true,
  storeRoles: ["OWNER"],
  storePermissions: ["BRANCH_VIEW", "BRANCH_MANAGE", "STAFF_VIEW"],
  branches: [],
};

export function aBranch(overrides: Partial<Branch> = {}): Branch {
  return {
    branchId: "b-q1",
    branchCode: "Q1-LELOI",
    name: "Quận 1 · Lê Lợi",
    status: "ACTIVE",
    address: { line: "68 Lê Lợi", ward: "Bến Nghé", district: "Quận 1", province: "TP.HCM" },
    location: null,
    phone: null,
    email: "q1@hayi.vn",
    timezone: "Asia/Ho_Chi_Minh",
    activatedAt: "2026-09-02T03:00:00Z",
    closedAt: null,
    createdAt: "2026-08-28T03:00:00Z",
    version: 3,
    ...overrides,
  };
}

/** A Branch response with its `ETag`, as the API sends it (API README §8). */
export function branchResponse(branch: Branch, status = 200) {
  const response = json(branch, status);
  response.headers.set("ETag", `"v${branch.version}"`);
  return response;
}

/** The whole app at `path`, signed in as `me`, with the step-up dialog wired like main.tsx. */
export function renderAdmin(path: string, handlers: Handlers, me: Me = owner) {
  const api = fakeApi({ "GET /auth/me": () => json(me), ...handlers });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const stepUpGate = createStepUpGate();
  const client = createBackofficeClient({ baseUrl: API_ORIGIN, onStepUpRequired: stepUpGate.request });
  const router = createAppRouter({ queryClient, api: client, stepUpGate }, createMemoryHistory({ initialEntries: [path] }));
  render(
    <QueryClientProvider client={queryClient}>
      <ApiProvider client={client}>
        <RouterProvider router={router} />
      </ApiProvider>
    </QueryClientProvider>,
  );
  return { api, router, user: userEvent.setup() };
}
