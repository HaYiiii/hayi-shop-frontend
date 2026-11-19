import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { json, problem } from "../../../test/fake-api";
import { owner, renderAdmin } from "../../branch/test/render-admin";
import type { OptionGroup } from "../api/option-groups";
import type { Product } from "../api/products";
import { aTree } from "../test/categories";
import { aGroup, aSugarGroup } from "../test/option-groups";
import { aProduct, productResponse } from "../test/products";

const catalogOwner = {
  ...owner,
  storePermissions: [...owner.storePermissions, "CATALOG_VIEW", "CATALOG_MANAGE", "CATALOG_PRICE_MANAGE"],
};
const catalogManager = { ...owner, storePermissions: ["BRANCH_VIEW", "CATALOG_VIEW", "CATALOG_MANAGE"] };
const catalogViewer = { ...owner, storePermissions: ["BRANCH_VIEW", "CATALOG_VIEW"] };

const milk = aGroup({ optionGroupId: "g-milk", code: "MILK", name: "Loại sữa", selectionType: "SINGLE", minSelect: 1, maxSelect: 1, items: [] });

function attachedGroup(group: OptionGroup, sortOrder: number, max: number | null = null): Product["optionGroups"][number] {
  return {
    optionGroupId: group.optionGroupId,
    code: group.code,
    name: group.name,
    selectionType: group.selectionType,
    minSelect: group.minSelect,
    maxSelect: max ?? group.maxSelect,
    minSelectOverride: null,
    maxSelectOverride: max,
    sortOrder,
  };
}

/** Sugar then Topping (max 2 here), Trân châu at 12.000 here; every PUT answers the next version. */
function server(initial: Product = aProduct({ optionGroups: [attachedGroup(aSugarGroup(), 0), attachedGroup(aGroup(), 1, 2)], optionItemOverrides: [{ optionItemId: "i-pearl", extraPriceOverride: 12000, isHidden: false }] }), library: OptionGroup[] = [aGroup(), aSugarGroup(), milk]) {
  let product = initial;
  let groups = library;
  const put = (next: Partial<Product>) => {
    product = { ...product, ...next, version: product.version + 1 };
    return productResponse(product);
  };
  return {
    get product() {
      return product;
    },
    setLibrary(next: OptionGroup[]) {
      groups = next;
    },
    handlers: {
      "GET /branches": () => json({ items: [] }),
      "GET /categories": () => json(aTree({ archived: true })),
      "GET /option-groups": () => json({ items: groups }),
      "GET /products/p-new": () => productResponse(product),
      "PUT /products/p-new/option-groups": (body: unknown) => {
        const input = (body as { groups: { optionGroupId: string; maxSelectOverride: number | null }[] }).groups;
        const attached = input.map((g, i) => attachedGroup(groups.find((l) => l.optionGroupId === g.optionGroupId)!, i, g.maxSelectOverride));
        const items = new Set(input.flatMap((g) => groups.find((l) => l.optionGroupId === g.optionGroupId)!.items.map((it) => it.optionItemId)));
        // Removing a group drops the overrides of its items (AC2).
        return put({ optionGroups: attached, optionItemOverrides: product.optionItemOverrides.filter((o) => items.has(o.optionItemId)) });
      },
      "PUT /products/p-new/option-item-overrides": (body: unknown) =>
        put({ optionItemOverrides: (body as { overrides: Product["optionItemOverrides"] }).overrides }),
      "POST /products/p-new/activate": () =>
        json({ type: "about:blank", title: "x", status: 422, code: "PRODUCT_ACTIVATION_INVALID", issues: [{ code: "OPTION_CONFIG_INVALID", optionGroupId: "g-topping" }] }, 422),
    },
  };
}

function ifMatchOf(api: ReturnType<typeof renderAdmin>["api"], route: string) {
  return api.calls.filter((c) => c.route === route).map((c) => c.headers.get("If-Match"));
}

const card = (name: string) => within(screen.getByRole("region", { name }));
const groupNames = () => screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Product options tab (D3d screen 24)", () => {
  it("is the tab Tuỳ chọn with the attached groups in order and their items", async () => {
    renderAdmin("/admin/products/p-new/options", server().handlers, catalogOwner);

    await screen.findByRole("heading", { level: 3, name: "Topping" });
    const tab = await screen.findByRole("link", { name: "Tuỳ chọn 2 nhóm" });
    expect(tab).toHaveAttribute("aria-current", "page");
    await waitFor(() => expect(groupNames()).toEqual(["Mức đường", "Topping"]));
    expect(card("Mức đường").getByText("Bắt buộc chọn 1 · theo nhóm")).toBeInTheDocument();
    // Nothing set here and no extra price: one line, the table opens on demand (screen 24).
    expect(card("Mức đường").getByText("100% · 50% — không thêm tiền.")).toBeInTheDocument();
    expect(card("Mức đường").queryByRole("table")).not.toBeInTheDocument();
    const topping = card("Topping");
    expect(topping.getByText("Theo nhóm: 0–3")).toBeInTheDocument();
    expect(topping.getByRole("textbox", { name: "Chọn tối đa Topping ở món này" })).toHaveValue("2");
    const pearl = within(topping.getByRole("row", { name: /Trân châu/ }));
    expect(pearl.getByText("+10.000 ₫")).toBeInTheDocument();
    expect(pearl.getByRole<HTMLInputElement>("textbox", { name: "Giá thêm Trân châu ở món này (đồng)" }).value.replace(/\s/g, " ")).toBe(
      "12.000 ₫",
    );
    expect(pearl.getByRole("checkbox", { name: "Hiện Trân châu ở món này" })).toBeChecked();
    // Archived library items are not offered.
    expect(topping.queryByRole("row", { name: /Pudding/ })).not.toBeInTheDocument();
  });

  it("saves the groups first, then the item overrides, each with the latest version", async () => {
    const fake = server();
    const { api, user } = renderAdmin("/admin/products/p-new/options", fake.handlers, catalogOwner);
    await screen.findByRole("heading", { level: 3, name: "Topping" });

    await user.click(screen.getByRole("button", { name: "Chuyển Topping lên" }));
    expect(groupNames()).toEqual(["Topping", "Mức đường"]);
    expect(screen.getByRole("button", { name: "Chuyển Topping lên" })).toHaveFocus();
    await user.clear(card("Topping").getByRole("textbox", { name: "Chọn tối đa Topping ở món này" }));
    await user.click(card("Topping").getByRole("checkbox", { name: "Hiện Thạch matcha ở món này" }));
    await user.click(card("Mức đường").getByRole("button", { name: "Chỉnh giá hoặc ẩn lựa chọn" }));
    expect(card("Mức đường").getByRole("textbox", { name: "Giá thêm 100% ở món này (đồng)" })).toHaveFocus();
    await user.type(card("Mức đường").getByRole("textbox", { name: "Giá thêm 50% ở món này (đồng)" }), "2000");
    await user.click(screen.getByRole("button", { name: "Lưu tuỳ chọn" }));

    expect(await screen.findByText("Đã lưu tuỳ chọn của món.")).toBeInTheDocument();
    expect(api.bodyOf("PUT /products/p-new/option-groups")).toEqual({
      groups: [
        { optionGroupId: "g-topping", minSelectOverride: null, maxSelectOverride: null },
        { optionGroupId: "g-sugar", minSelectOverride: null, maxSelectOverride: null },
      ],
    });
    expect(api.bodyOf("PUT /products/p-new/option-item-overrides")).toEqual({
      overrides: [
        { optionItemId: "i-pearl", extraPriceOverride: 12000, isHidden: false },
        { optionItemId: "i-jelly", extraPriceOverride: null, isHidden: true },
        { optionItemId: "i-s50", extraPriceOverride: 2000, isHidden: false },
      ],
    });
    expect(ifMatchOf(api, "PUT /products/p-new/option-groups")).toEqual(['"v0"']);
    expect(ifMatchOf(api, "PUT /products/p-new/option-item-overrides")).toEqual(['"v1"']);
  });

  it("attaches a group from the library and detaches one; detaching needs no overrides request", async () => {
    const fake = server();
    const { api, user } = renderAdmin("/admin/products/p-new/options", fake.handlers, catalogOwner);
    await screen.findByRole("heading", { level: 3, name: "Topping" });

    const select = screen.getByRole("combobox", { name: "Gắn nhóm tuỳ chọn" });
    expect(within(select).getAllByRole("option").map((o) => o.textContent)).toEqual(["Chọn nhóm…", "Loại sữa"]);
    await user.selectOptions(select, "Loại sữa");
    await user.click(screen.getByRole("button", { name: "Gắn" }));
    expect(screen.getByRole("heading", { level: 3, name: "Loại sữa" })).toHaveFocus();
    await user.click(card("Topping").getByRole("button", { name: "Gỡ khỏi món" }));
    expect(select).toHaveFocus();
    expect(groupNames()).toEqual(["Mức đường", "Loại sữa"]);

    await user.click(screen.getByRole("button", { name: "Lưu tuỳ chọn" }));
    expect(await screen.findByText("Đã lưu tuỳ chọn của món.")).toBeInTheDocument();
    expect(api.bodyOf("PUT /products/p-new/option-groups")).toEqual({
      groups: [
        { optionGroupId: "g-sugar", minSelectOverride: null, maxSelectOverride: null },
        { optionGroupId: "g-milk", minSelectOverride: null, maxSelectOverride: null },
      ],
    });
    expect(api.calls.some((c) => c.route === "PUT /products/p-new/option-item-overrides")).toBe(false);
    expect(screen.getByRole("link", { name: "Tuỳ chọn 2 nhóm" })).toBeInTheDocument();

    // Attached again, Topping starts from the library: its old price for this Product went with it (AC2).
    await user.selectOptions(select, "Topping");
    await user.click(screen.getByRole("button", { name: "Gắn" }));
    expect(card("Topping").getByRole("textbox", { name: "Giá thêm Trân châu ở món này (đồng)" })).toHaveValue("");
  });

  it("checks min/max at the right group before sending", async () => {
    const fake = server();
    const { api, user } = renderAdmin("/admin/products/p-new/options", fake.handlers, catalogOwner);
    const topping = card((await screen.findByRole("heading", { level: 3, name: "Topping" })).textContent);
    const min = topping.getByRole("textbox", { name: "Chọn tối thiểu Topping ở món này" });

    await user.type(min, "3");
    await user.click(screen.getByRole("button", { name: "Lưu tuỳ chọn" }));
    const max = topping.getByRole("textbox", { name: "Chọn tối đa Topping ở món này" });
    expect(max).toHaveAccessibleDescription("Tối đa phải lớn hơn hoặc bằng tối thiểu (3).");
    expect(max).toHaveFocus();
    expect(api.calls.some((c) => c.route.startsWith("PUT"))).toBe(false);
  });

  it("warns, without blocking the save, when max is above the items still shown (W4)", async () => {
    const fake = server();
    const { api, user } = renderAdmin("/admin/products/p-new/options", fake.handlers, catalogOwner);
    await screen.findByRole("heading", { level: 3, name: "Topping" });

    await user.click(card("Topping").getByRole("checkbox", { name: "Hiện Trân châu ở món này" }));
    expect(card("Topping").getByText(/Tối đa 2 lớn hơn số lựa chọn đang hiện \(1\)/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Lưu tuỳ chọn" }));
    expect(await screen.findByText("Đã lưu tuỳ chọn của món.")).toBeInTheDocument();
    expect(api.bodyOf("PUT /products/p-new/option-item-overrides")).toEqual({
      overrides: [{ optionItemId: "i-pearl", extraPriceOverride: 12000, isHidden: true }],
    });
  });

  it("when a group was archived in the library meanwhile, marks it and asks to remove it", async () => {
    const fake = server();
    const { user } = renderAdmin(
      "/admin/products/p-new/options",
      {
        ...fake.handlers,
        "PUT /products/p-new/option-groups": () => {
          fake.setLibrary([aGroup({ status: "ARCHIVED" }), aSugarGroup(), milk]);
          return problem(409, "CATALOG_OPTION_ARCHIVED");
        },
      },
      catalogOwner,
    );
    await screen.findByRole("heading", { level: 3, name: "Topping" });
    await user.click(screen.getByRole("button", { name: "Chuyển Topping lên" }));
    await user.click(screen.getByRole("button", { name: "Lưu tuỳ chọn" }));

    expect(await screen.findByText(/một nhóm vừa đổi ở thư viện tuỳ chọn/)).toBeInTheDocument();
    expect(await card("Topping").findByText("Nhóm này đã lưu trữ ở thư viện. Gỡ khỏi món để lưu.")).toBeInTheDocument();
  });

  it("from an OPTION_CONFIG_INVALID issue, Sửa ngay opens the tab on that group", async () => {
    const { user } = renderAdmin("/admin/products/p-new", server().handlers, catalogOwner);
    await user.click(await screen.findByRole("button", { name: "Kích hoạt" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Nhóm tuỳ chọn “Topping” chưa hợp lệ với món này");
    await user.click(within(alert).getByRole("link", { name: "Sửa ngay" }));
    await waitFor(() => expect(screen.getByRole("heading", { level: 3, name: "Topping" })).toHaveFocus());
    expect(screen.getByRole("link", { name: "Tuỳ chọn 2 nhóm" })).toHaveAttribute("aria-current", "page");
  });

  it("is read-only without CATALOG_MANAGE", async () => {
    renderAdmin("/admin/products/p-new/options", server().handlers, catalogViewer);
    await screen.findByRole("heading", { level: 3, name: "Topping" });
    expect(screen.queryByRole("button", { name: "Lưu tuỳ chọn" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Gỡ khỏi món" })).not.toBeInTheDocument();
    expect(card("Topping").getByRole("checkbox", { name: "Hiện Trân châu ở món này" })).toBeDisabled();
  });

  it("keeps override prices read-only without CATALOG_PRICE_MANAGE", async () => {
    renderAdmin("/admin/products/p-new/options", server().handlers, catalogManager);
    await screen.findByRole("heading", { level: 3, name: "Topping" });
    expect(card("Topping").getByRole("textbox", { name: "Giá thêm Trân châu ở món này (đồng)" })).toHaveAttribute("readonly");
    expect(card("Topping").getByRole("checkbox", { name: "Hiện Trân châu ở món này" })).toBeEnabled();
  });
});
