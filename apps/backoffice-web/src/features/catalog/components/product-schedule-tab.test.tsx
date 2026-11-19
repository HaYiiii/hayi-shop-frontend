import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { json } from "../../../test/fake-api";
import { owner, renderAdmin } from "../../branch/test/render-admin";
import type { Product } from "../api/products";
import { aTree } from "../test/categories";
import { aProduct, productResponse } from "../test/products";

const catalogOwner = { ...owner, storePermissions: [...owner.storePermissions, "CATALOG_VIEW", "CATALOG_MANAGE", "CATALOG_PRICE_MANAGE"] };
const catalogViewer = { ...owner, storePermissions: ["BRANCH_VIEW", "CATALOG_VIEW"] };
const PATH = "/admin/products/p-new/schedule";

function server(initial: Product = aProduct()) {
  let product = initial;
  return {
    handlers: {
      "GET /branches": () => json({ items: [] }),
      "GET /categories": () => json(aTree()),
      "GET /products/p-new": () => productResponse(product),
      "PUT /products/p-new/selling-schedules": (body: unknown) => {
        product = { ...product, ...(body as { schedules: Product["sellingSchedules"] }), sellingSchedules: (body as { schedules: Product["sellingSchedules"] }).schedules, version: product.version + 1 };
        return productResponse(product);
      },
    },
  };
}

function ifMatchOf(api: ReturnType<typeof renderAdmin>["api"], route: string) {
  return api.calls.filter((c) => c.route === route).map((c) => c.headers.get("If-Match"));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Product selling schedule (D3d screen 26)", () => {
  it("is the tab Lịch bán & tag; no period means sold whenever the Branch takes orders", async () => {
    renderAdmin(PATH, server().handlers, catalogOwner);
    expect(await screen.findByRole("link", { name: "Lịch bán & tag" })).toHaveAttribute("aria-current", "page");
    expect(await screen.findByText("Món đang bán mọi lúc chi nhánh nhận đơn.")).toBeInTheDocument();
  });

  it("adds a period with windows and saves the whole list with If-Match", async () => {
    const { api, user } = renderAdmin(PATH, server().handlers, catalogOwner);
    await user.click(await screen.findByRole("button", { name: "Thêm đợt bán" }));
    const period = within(screen.getByRole("group", { name: "Đợt bán 1" }));
    expect(period.getByLabelText("Từ ngày")).toHaveFocus();
    await user.type(period.getByLabelText("Đợt 1 khung 1 bắt đầu"), "0700");
    await user.type(period.getByLabelText("Đợt 1 khung 1 kết thúc"), "1400");
    await user.click(period.getByRole("button", { name: "Thêm khung" }));
    await user.selectOptions(period.getByLabelText("Đợt 1 khung 2 áp dụng"), "Thứ 7");
    await user.type(period.getByLabelText("Đợt 1 khung 2 bắt đầu"), "1500");
    await user.type(period.getByLabelText("Đợt 1 khung 2 kết thúc"), "1800");
    await user.click(screen.getByRole("button", { name: "Lưu lịch bán" }));

    expect(await screen.findByText(/Đã lưu lịch bán/)).toBeInTheDocument();
    expect(api.bodyOf("PUT /products/p-new/selling-schedules")).toEqual({
      schedules: [
        {
          startDate: null,
          endDate: null,
          windows: [
            { dayOfWeek: null, start: "07:00", end: "14:00" },
            { dayOfWeek: 6, start: "15:00", end: "18:00" },
          ],
        },
      ],
    });
    expect(ifMatchOf(api, "PUT /products/p-new/selling-schedules")).toEqual(['"v0"']);
  });

  it("shows a window error at its row before sending and puts the keyboard there", async () => {
    const { api, user } = renderAdmin(PATH, server().handlers, catalogOwner);
    await user.click(await screen.findByRole("button", { name: "Thêm đợt bán" }));
    await user.type(screen.getByLabelText("Đợt 1 khung 1 bắt đầu"), "1500");
    await user.type(screen.getByLabelText("Đợt 1 khung 1 kết thúc"), "1400");
    await user.click(screen.getByRole("button", { name: "Lưu lịch bán" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Đợt 1 khung 1: Giờ kết thúc phải sau giờ bắt đầu, không qua nửa đêm.");
    expect(screen.getByLabelText("Đợt 1 khung 1 áp dụng")).toHaveFocus();
    expect(api.calls.some((c) => c.route.startsWith("PUT"))).toBe(false);
  });

  it("puts 422 CATALOG_SELLING_SCHEDULE_INVALID errors[] on the right row", async () => {
    const fake = server(
      aProduct({ sellingSchedules: [{ startDate: null, endDate: null, windows: [{ dayOfWeek: null, start: "07:00", end: "11:00" }] }] }),
    );
    const { user } = renderAdmin(
      PATH,
      {
        ...fake.handlers,
        "PUT /products/p-new/selling-schedules": () =>
          json({ status: 422, code: "CATALOG_SELLING_SCHEDULE_INVALID", errors: [{ field: "schedules[0].windows[0]", code: "OVERLAP" }] }, 422),
      },
      catalogOwner,
    );
    const start = await screen.findByLabelText("Đợt 1 khung 1 bắt đầu");
    expect(start).toHaveValue("07:00");
    await user.clear(screen.getByLabelText("Đợt 1 khung 1 kết thúc"));
    await user.type(screen.getByLabelText("Đợt 1 khung 1 kết thúc"), "1200");
    await user.click(screen.getByRole("button", { name: "Lưu lịch bán" }));
    expect(await screen.findByText("Đợt 1 khung 1: Khung này trùng giờ với một khung khác cùng ngày trong đợt.")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText("Đợt 1 khung 1 áp dụng")).toHaveFocus());
  });

  it("is read-only without CATALOG_MANAGE", async () => {
    renderAdmin(
      PATH,
      server(aProduct({ sellingSchedules: [{ startDate: "2026-12-01", endDate: null, windows: [] }] })).handlers,
      catalogViewer,
    );
    expect(await screen.findByLabelText("Từ ngày")).toHaveAttribute("readonly");
    expect(screen.queryByRole("button", { name: "Lưu lịch bán" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Thêm đợt bán" })).not.toBeInTheDocument();
  });
});
