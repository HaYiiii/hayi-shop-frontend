import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CustomerProviders } from "../../../lib/customer-api";
import { AccountScreen } from "./account-screen";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push: replace, refresh: vi.fn() }) }));

function serve(answers: Record<string, () => Response>) {
  const routes: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((request: Request) => {
      const route = `${request.method} ${new URL(request.url).pathname.replace("/api/customer/v1", "")}`;
      routes.push(route);
      return Promise.resolve(answers[route]?.() ?? Response.json({ status: 404, code: "NOT_FOUND" }, { status: 404 }));
    }),
  );
  return routes;
}

const unauthenticated = () => Response.json({ status: 401, code: "AUTH_REQUIRED" }, { status: 401 });

afterEach(() => {
  vi.unstubAllGlobals();
  replace.mockReset();
});

describe("Account tab (FE #70; full screen 11 in #72)", () => {
  it("sends a signed-out Customer to sign-in and back here, after one refresh attempt", async () => {
    const routes = serve({ "GET /auth/me": unauthenticated, "POST /auth/refresh": unauthenticated });
    render(
      <CustomerProviders>
        <AccountScreen />
      </CustomerProviders>,
    );
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login?next=%2Faccount"));
    expect(routes).toEqual(["GET /auth/me", "POST /auth/refresh"]);
  });

  it("greets a signed-in Customer and signs out", async () => {
    const routes = serve({
      "GET /auth/me": () => Response.json({ userId: "u", customerId: "c", displayName: "Lan", phoneMasked: "090•••567" }),
      "POST /auth/logout": () => new Response(null, { status: 204 }),
    });
    const user = userEvent.setup();
    render(
      <CustomerProviders>
        <AccountScreen />
      </CustomerProviders>,
    );
    expect(await screen.findByRole("heading", { level: 1, name: "Chào Lan" })).toBeInTheDocument();
    expect(screen.getByText("090•••567")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Đăng xuất" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
    expect(routes).toContain("POST /auth/logout");
  });
});

describe("Sign-out failures (FE #70 review)", () => {
  const me = () => Response.json({ userId: "u", customerId: "c", displayName: "Lan", phoneMasked: "090•••567" });

  it("stays signed in and says so when the sign-out request fails", async () => {
    serve({ "GET /auth/me": me, "POST /auth/logout": () => Response.json({ status: 503, code: "SERVICE_UNAVAILABLE" }, { status: 503 }) });
    const user = userEvent.setup();
    render(
      <CustomerProviders>
        <AccountScreen />
      </CustomerProviders>,
    );
    await user.click(await screen.findByRole("button", { name: "Đăng xuất" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Chưa đăng xuất được.");
    expect(screen.getByRole("heading", { level: 1, name: "Chào Lan" })).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("counts a 401 on sign-out as signed out", async () => {
    serve({
      "GET /auth/me": me,
      "POST /auth/logout": () => Response.json({ status: 401, code: "AUTH_REQUIRED" }, { status: 401 }),
      "POST /auth/refresh": () => Response.json({ status: 401, code: "AUTH_REQUIRED" }, { status: 401 }),
    });
    const user = userEvent.setup();
    render(
      <CustomerProviders>
        <AccountScreen />
      </CustomerProviders>,
    );
    await user.click(await screen.findByRole("button", { name: "Đăng xuất" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
    expect(replace).not.toHaveBeenCalledWith("/login?next=%2Faccount");
  });
});
