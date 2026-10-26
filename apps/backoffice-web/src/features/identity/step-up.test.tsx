import { createBackofficeClient } from "@hayi/api-client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiProvider } from "../../api";
import { API_ORIGIN, fakeApi, json, noContent, problem } from "../../test/fake-api";
import { StepUpDialog, createStepUpGate } from "./step-up";

const me = { userId: "u-1", storeRoles: ["OWNER"], storePermissions: [], branches: [] };

/** A sensitive action: answers STEP_UP_REQUIRED until /auth/step-up succeeds (API 01-security §8). */
function setup(stepUp: (body: unknown) => Response = () => noContent()) {
  let steppedUp = false;
  const api = fakeApi({
    "GET /auth/me": () => (steppedUp ? json(me) : problem(403, "STEP_UP_REQUIRED")),
    "POST /auth/step-up": (body) => {
      const res = stepUp(body);
      if (res.ok) steppedUp = true;
      return res;
    },
  });
  const gate = createStepUpGate();
  const onSessionRevoked = vi.fn();
  const client = createBackofficeClient({ baseUrl: API_ORIGIN, onStepUpRequired: gate.request });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ApiProvider client={client}>
        <StepUpDialog gate={gate} onSessionRevoked={onSessionRevoked} />
      </ApiProvider>
    </QueryClientProvider>,
  );
  const action = client.GET("/auth/me");
  return { api, action, onSessionRevoked, user: userEvent.setup() };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("StepUpDialog", () => {
  it("asks for the TOTP code, then the action goes through", async () => {
    const { api, action, user } = setup();

    const dialog = await screen.findByRole("dialog", { name: "Xác thực lại để tiếp tục" });
    expect(dialog).toHaveTextContent("không phải nhập lại trong 5 phút");
    await user.type(screen.getByLabelText("Mã từ ứng dụng xác thực"), "482913");
    await user.click(screen.getByRole("button", { name: "Xác thực và tiếp tục" }));

    expect((await action).response.status).toBe(200);
    expect(api.bodyOf("POST /auth/step-up")).toEqual({ code: "482913" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("lets a user without MFA re-enter the password (Decision D4)", async () => {
    const { api, action, user } = setup();

    await user.click(await screen.findByRole("button", { name: "Chưa bật xác thực 2 lớp? Dùng mật khẩu" }));
    await user.type(screen.getByLabelText("Mật khẩu của bạn"), "mat khau dung 01");
    await user.click(screen.getByRole("button", { name: "Xác thực và tiếp tục" }));

    expect((await action).response.status).toBe(200);
    expect(api.bodyOf("POST /auth/step-up")).toEqual({ password: "mat khau dung 01" });
  });

  it("keeps the dialog open after a wrong code", async () => {
    const { user } = setup(() => problem(401, "MFA_CODE_INVALID"));

    await user.type(await screen.findByLabelText("Mã từ ứng dụng xác thực"), "000000");
    await user.click(screen.getByRole("button", { name: "Xác thực và tiếp tục" }));

    expect(await screen.findByText(/Mã chưa đúng/)).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("gives the 403 back to the caller on cancel", async () => {
    const { action, user } = setup();

    await user.click(await screen.findByRole("button", { name: "Hủy" }));

    const { response, error } = await action;
    expect(response.status).toBe(403);
    expect(error).toMatchObject({ code: "STEP_UP_REQUIRED" });
  });

  it("ends the session after too many wrong codes (Decision L7)", async () => {
    const { onSessionRevoked, user } = setup(() => problem(401, "AUTH_SESSION_REVOKED"));

    await user.type(await screen.findByLabelText("Mã từ ứng dụng xác thực"), "000000");
    await user.click(screen.getByRole("button", { name: "Xác thực và tiếp tục" }));

    await waitFor(() => expect(onSessionRevoked).toHaveBeenCalledOnce());
  });
});
