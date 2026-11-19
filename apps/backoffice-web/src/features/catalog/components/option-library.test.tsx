import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { json, problem } from "../../../test/fake-api";
import { owner, renderAdmin } from "../../branch/test/render-admin";
import type { OptionGroup } from "../api/option-groups";
import { aGroup, aSugarGroup, groupResponse } from "../test/option-groups";

const catalogOwner = {
  ...owner,
  storePermissions: [...owner.storePermissions, "CATALOG_VIEW", "CATALOG_MANAGE", "CATALOG_PRICE_MANAGE"],
};
const catalogManager = { ...owner, storePermissions: ["BRANCH_VIEW", "CATALOG_VIEW", "CATALOG_MANAGE"] };
const catalogViewer = { ...owner, storePermissions: ["BRANCH_VIEW", "CATALOG_VIEW"] };

const archivedGroup = aGroup({ optionGroupId: "g-shot", code: "SHOT", name: "Thêm shot", status: "ARCHIVED", items: [] });

/** The library the fake server holds; each write answers the group with the next version. */
function server(initial: OptionGroup[] = [aGroup(), aSugarGroup(), archivedGroup]) {
  let groups = initial;
  const find = (id: string) => groups.find((g) => g.optionGroupId === id)!;
  const put = (next: OptionGroup) => {
    groups = groups.map((g) => (g.optionGroupId === next.optionGroupId ? next : g));
    return groupResponse(next);
  };
  return {
    set(next: OptionGroup[]) {
      groups = next;
    },
    handlers: {
      "GET /branches": () => json({ items: [] }),
      "GET /option-groups": () => json({ items: groups }),
      "PATCH /option-groups/g-topping": (body: unknown) => {
        const g = find("g-topping");
        return put({ ...g, ...(body as Partial<OptionGroup>), version: g.version + 1 });
      },
      "PATCH /option-groups/g-topping/items/i-pearl": (body: unknown) => {
        const g = find("g-topping");
        const items = g.items.map((i) => (i.optionItemId === "i-pearl" ? { ...i, ...(body as object) } : i));
        return put({ ...g, items, version: g.version + 1 });
      },
      "POST /option-groups/g-topping/items": (body: unknown) => {
        const g = find("g-topping");
        const input = body as { code: string; name: string; defaultExtraPrice: number; isDefaultSelected: boolean };
        const added = { optionItemId: `i-${input.code}`, status: "ACTIVE" as const, sortOrder: 9, ...input };
        return put({ ...g, items: [...g.items, added], version: g.version + 1 });
      },
      "POST /option-groups/g-topping/items/i-jelly/archive": () => {
        const g = find("g-topping");
        const items = g.items.map((i) => (i.optionItemId === "i-jelly" ? { ...i, status: "ARCHIVED" as const } : i));
        return put({ ...g, items, version: g.version + 1 });
      },
      "POST /option-groups": (body: unknown) => {
        const input = body as OptionGroup;
        const created: OptionGroup = {
          ...aGroup(),
          ...input,
          optionGroupId: "g-milk",
          version: 0,
          items: input.items.map((i, n) => ({ ...i, optionItemId: `i-milk-${n}`, status: "ACTIVE", sortOrder: n + 1 })),
        };
        groups = [...groups, created];
        return groupResponse(created, 201);
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

describe("Option library (D3d screen 27)", () => {
  it("is a Tuỳ chọn link under Quản trị and opens the first group with its items", async () => {
    renderAdmin("/admin/options", server().handlers, catalogOwner);

    expect(await screen.findByRole("heading", { level: 1, name: "Tuỳ chọn" })).toBeInTheDocument();
    const nav = within(screen.getByRole("region", { name: "Quản trị" }));
    expect(nav.getByRole("link", { name: "Tuỳ chọn" })).toHaveAttribute("aria-current", "page");

    const list = within(await screen.findByRole("region", { name: "Nhóm tuỳ chọn" }));
    expect(list.getAllByRole("button").map((b) => b.textContent)).toEqual([
      "Mức đường2 lựa chọn",
      "Topping2 lựa chọn",
      "Thêm shot0 lựa chọnĐã lưu trữ",
    ]);
    expect(list.getByRole("button", { name: /Mức đường/ })).toHaveAttribute("aria-current", "true");

    await userClick(list.getByRole("button", { name: /Topping/ }));
    const form = within(screen.getByRole("form", { name: "Topping" }));
    expect(form.getByRole("textbox", { name: "Tên nhóm (khách thấy)" })).toHaveValue("Topping");
    expect(form.getByRole("radio", { name: /Chọn nhiều/ })).toBeChecked();
    expect(form.getByRole("textbox", { name: "Tên lựa chọn 1" })).toHaveValue("Trân châu");
    // The archived item is read-only.
    expect(form.queryByRole("textbox", { name: "Tên lựa chọn 3" })).not.toBeInTheDocument();
    expect(form.getByRole("row", { name: /Pudding/ })).toHaveTextContent("Đã lưu trữ");
  });

  it("saves group, item and new item edits in order, each with the latest version", async () => {
    const { api, user } = renderAdmin("/admin/options?group=g-topping", server().handlers, catalogOwner);
    const form = within(await screen.findByRole("form", { name: "Topping" }));

    await user.clear(form.getByRole("textbox", { name: "Tên nhóm (khách thấy)" }));
    await user.type(form.getByRole("textbox", { name: "Tên nhóm (khách thấy)" }), "Topping thêm");
    await user.clear(form.getByRole("textbox", { name: "Giá thêm lựa chọn 1 (đồng)" }));
    await user.type(form.getByRole("textbox", { name: "Giá thêm lựa chọn 1 (đồng)" }), "12000");
    await user.click(form.getByRole("button", { name: "Thêm lựa chọn" }));
    expect(form.getByRole("textbox", { name: "Tên lựa chọn 4" })).toHaveFocus();
    await user.type(form.getByRole("textbox", { name: "Tên lựa chọn 4" }), "Kem cheese");
    expect(form.getByRole("textbox", { name: "Mã lựa chọn 4" })).toHaveValue("KEM-CHEESE");
    await user.type(form.getByRole("textbox", { name: "Giá thêm lựa chọn 4 (đồng)" }), "15.000");

    await user.click(form.getByRole("button", { name: "Lưu nhóm" }));

    expect(await screen.findByText("Đã lưu nhóm.")).toBeInTheDocument();
    expect(api.bodyOf("PATCH /option-groups/g-topping")).toEqual({ name: "Topping thêm" });
    expect(api.bodyOf("PATCH /option-groups/g-topping/items/i-pearl")).toEqual({ defaultExtraPrice: 12000 });
    expect(api.bodyOf("POST /option-groups/g-topping/items")).toEqual({
      code: "KEM-CHEESE",
      name: "Kem cheese",
      defaultExtraPrice: 15000,
      isDefaultSelected: false,
    });
    expect(ifMatchOf(api, "PATCH /option-groups/g-topping")).toEqual(['"v7"']);
    expect(ifMatchOf(api, "PATCH /option-groups/g-topping/items/i-pearl")).toEqual(['"v8"']);
    expect(ifMatchOf(api, "POST /option-groups/g-topping/items")).toEqual(['"v9"']);
    expect(screen.getByRole("form", { name: "Topping thêm" })).toBeInTheDocument();
    expect(within(screen.getByRole("form", { name: "Topping thêm" })).getByRole("row", { name: /KEM-CHEESE/ })).toHaveTextContent(
      "Đang dùng",
    );
  });

  it("stops a save at the failed request, keeps what went through and sends only the rest next time", async () => {
    const fake = server();
    let taken = true;
    const { api, user } = renderAdmin(
      "/admin/options?group=g-topping",
      {
        ...fake.handlers,
        "POST /option-groups/g-topping/items": (body: unknown) =>
          taken ? problem(409, "CATALOG_CODE_TAKEN") : fake.handlers["POST /option-groups/g-topping/items"](body),
      },
      catalogOwner,
    );
    const form = within(await screen.findByRole("form", { name: "Topping" }));

    await user.clear(form.getByRole("textbox", { name: "Tên nhóm (khách thấy)" }));
    await user.type(form.getByRole("textbox", { name: "Tên nhóm (khách thấy)" }), "Topping mới");
    await user.click(form.getByRole("button", { name: "Thêm lựa chọn" }));
    await user.type(form.getByRole("textbox", { name: "Tên lựa chọn 4" }), "Trân châu đen");
    await user.type(form.getByRole("textbox", { name: "Giá thêm lựa chọn 4 (đồng)" }), "5000");
    await user.click(form.getByRole("button", { name: "Lưu nhóm" }));

    const renamed = within(await screen.findByRole("form", { name: "Topping mới" }));
    const code = renamed.getByRole("textbox", { name: "Mã lựa chọn 4" });
    await waitFor(() => expect(code).toHaveAccessibleDescription(/Mã này đã có trong nhóm/));
    expect(code).toHaveFocus();
    expect(renamed.getByRole("textbox", { name: "Tên nhóm (khách thấy)" })).toHaveValue("Topping mới");

    taken = false;
    await user.clear(code);
    await user.type(code, "TRAN-CHAU-2");
    await user.click(renamed.getByRole("button", { name: "Lưu nhóm" }));
    expect(await screen.findByText("Đã lưu nhóm.")).toBeInTheDocument();
    // The group patch went through the first time; the second save only adds the item, on the new version.
    expect(api.calls.filter((c) => c.route === "PATCH /option-groups/g-topping")).toHaveLength(1);
    expect(ifMatchOf(api, "POST /option-groups/g-topping/items")).toEqual(['"v8"', '"v8"']);
    expect(api.bodyOf("POST /option-groups/g-topping/items")).toMatchObject({ code: "TRAN-CHAU-2" });
  });

  it("shows OPTION_GROUP_MINMAX_INVALID at min/max and checks min/max before sending", async () => {
    const fake = server();
    const { api, user } = renderAdmin(
      "/admin/options?group=g-topping",
      { ...fake.handlers, "PATCH /option-groups/g-topping": () => problem(422, "OPTION_GROUP_MINMAX_INVALID") },
      catalogOwner,
    );
    const form = within(await screen.findByRole("form", { name: "Topping" }));
    const max = form.getByRole("textbox", { name: "Chọn tối đa" });

    await user.clear(max);
    await user.type(max, "0");
    await user.click(form.getByRole("button", { name: "Lưu nhóm" }));
    expect(max).toHaveAccessibleDescription("Nhập số nguyên từ 1.");
    expect(max).toHaveFocus();
    expect(api.calls.some((c) => c.route === "PATCH /option-groups/g-topping")).toBe(false);

    // A fixed value is valid again on the next submit.
    await user.clear(max);
    await user.type(max, "3");
    await user.click(form.getByRole("button", { name: "Lưu nhóm" }));
    expect(max).not.toHaveAttribute("aria-invalid");

    await user.clear(max);
    await user.type(max, "2");
    await user.click(form.getByRole("button", { name: "Lưu nhóm" }));
    await waitFor(() => expect(max).toHaveAttribute("aria-invalid", "true"));
    expect(max).toHaveAccessibleDescription(
      "Tối thiểu, tối đa và số lựa chọn chọn sẵn chưa khớp: tối thiểu ≤ tối đa, chọn một thì tối đa là 1, chọn sẵn không quá tối đa.",
    );
  });

  it("keeps what was typed when the group changed meanwhile, and saves on top of the new version", async () => {
    const fake = server();
    let conflict = true;
    const { api, user } = renderAdmin(
      "/admin/options?group=g-topping",
      {
        ...fake.handlers,
        "PATCH /option-groups/g-topping": (body: unknown) =>
          conflict ? problem(412, "VERSION_CONFLICT") : fake.handlers["PATCH /option-groups/g-topping"](body),
      },
      catalogOwner,
    );
    const form = within(await screen.findByRole("form", { name: "Topping" }));
    await user.clear(form.getByRole("textbox", { name: "Tên nhóm (khách thấy)" }));
    await user.type(form.getByRole("textbox", { name: "Tên nhóm (khách thấy)" }), "Topping mới");
    await user.click(form.getByRole("button", { name: "Lưu nhóm" }));

    expect(await form.findByText(/Nhóm vừa được người khác cập nhật/)).toBeInTheDocument();
    // Someone else raised min meanwhile.
    fake.set([aGroup({ minSelect: 1, version: 8 }), aSugarGroup(), archivedGroup]);
    conflict = false;
    await user.click(form.getByRole("button", { name: "Tải lại" }));

    await waitFor(() => expect(form.getByRole("textbox", { name: "Chọn tối thiểu" })).toHaveValue("1"));
    expect(form.getByRole("textbox", { name: "Tên nhóm (khách thấy)" })).toHaveValue("Topping mới");
    await user.click(form.getByRole("button", { name: "Lưu nhóm" }));
    expect(await screen.findByText("Đã lưu nhóm.")).toBeInTheDocument();
    expect(api.bodyOf("PATCH /option-groups/g-topping")).toEqual({ name: "Topping mới" });
    expect(ifMatchOf(api, "PATCH /option-groups/g-topping").at(-1)).toBe('"v8"');
  });

  it("creates a group with items and opens it", async () => {
    const { api, router, user } = renderAdmin("/admin/options", server().handlers, catalogOwner);

    await user.click(await screen.findByRole("button", { name: "Tạo nhóm" }));
    const form = within(screen.getByRole("form", { name: "Nhóm mới" }));
    await user.type(form.getByRole("textbox", { name: "Mã nhóm" }), "milk");
    await user.click(form.getByRole("radio", { name: /Chọn một/ }));
    await user.type(form.getByRole("textbox", { name: "Tên nhóm (khách thấy)" }), "Loại sữa");
    await user.clear(form.getByRole("textbox", { name: "Chọn tối thiểu" }));
    await user.type(form.getByRole("textbox", { name: "Chọn tối thiểu" }), "1");
    await user.click(form.getByRole("button", { name: "Thêm lựa chọn" }));
    await user.type(form.getByRole("textbox", { name: "Tên lựa chọn 1" }), "Sữa yến mạch");
    await user.type(form.getByRole("textbox", { name: "Giá thêm lựa chọn 1 (đồng)" }), "5000");
    await user.click(form.getByRole("checkbox", { name: "Chọn sẵn lựa chọn 1" }));
    await user.click(form.getByRole("button", { name: "Tạo nhóm" }));

    expect(await screen.findByText("Đã tạo nhóm “Loại sữa”.")).toBeInTheDocument();
    expect(api.bodyOf("POST /option-groups")).toEqual({
      code: "MILK",
      name: "Loại sữa",
      selectionType: "SINGLE",
      minSelect: 1,
      maxSelect: 1,
      items: [{ code: "SUA-YEN-MACH", name: "Sữa yến mạch", defaultExtraPrice: 5000, isDefaultSelected: true }],
    });
    expect(router.state.location.search).toEqual({ group: "g-milk" });
    expect(screen.getByRole("form", { name: "Loại sữa" })).toBeInTheDocument();
  });

  it("puts a taken group code on its field", async () => {
    const fake = server();
    const { user } = renderAdmin(
      "/admin/options?group=new",
      { ...fake.handlers, "POST /option-groups": () => problem(409, "CATALOG_CODE_TAKEN") },
      catalogOwner,
    );
    const form = within(await screen.findByRole("form", { name: "Nhóm mới" }));
    await user.type(form.getByRole("textbox", { name: "Mã nhóm" }), "TOPPING");
    await user.type(form.getByRole("textbox", { name: "Tên nhóm (khách thấy)" }), "Topping 2");
    await user.click(form.getByRole("button", { name: "Tạo nhóm" }));

    const code = form.getByRole("textbox", { name: "Mã nhóm" });
    await waitFor(() => expect(code).toHaveFocus());
    expect(code).toHaveAccessibleDescription("Mã nhóm này đã được dùng, kể cả bởi nhóm đã lưu trữ. Đặt mã khác.");
  });

  it("archives an item after confirming", async () => {
    const { user } = renderAdmin("/admin/options?group=g-topping", server().handlers, catalogOwner);
    const form = within(await screen.findByRole("form", { name: "Topping" }));

    await user.click(form.getByRole("button", { name: "Lưu trữ lựa chọn 2" }));
    const dialog = within(screen.getByRole("dialog", { name: "Lưu trữ “Thạch matcha”?" }));
    await user.click(dialog.getByRole("button", { name: "Lưu trữ lựa chọn" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(form.getByRole("row", { name: /Thạch matcha/ })).toHaveTextContent("Đã lưu trữ");
    expect(form.queryByRole("textbox", { name: "Tên lựa chọn 2" })).not.toBeInTheDocument();
  });

  it("is read-only without CATALOG_MANAGE, and prices are read-only without CATALOG_PRICE_MANAGE", async () => {
    renderAdmin("/admin/options?group=g-topping", server().handlers, catalogViewer);
    const viewerForm = within(await screen.findByRole("form", { name: "Topping" }));
    expect(screen.queryByRole("button", { name: "Tạo nhóm" })).not.toBeInTheDocument();
    expect(viewerForm.queryByRole("button", { name: "Lưu nhóm" })).not.toBeInTheDocument();
    expect(viewerForm.getByRole("textbox", { name: "Tên nhóm (khách thấy)" })).toHaveAttribute("readonly");
    expect(viewerForm.queryByRole("textbox", { name: "Tên lựa chọn 1" })).not.toBeInTheDocument();
    vi.unstubAllGlobals();
    document.body.innerHTML = "";

    renderAdmin("/admin/options?group=g-topping", server().handlers, catalogManager);
    const form = within(await screen.findByRole("form", { name: "Topping" }));
    expect(form.getByRole("textbox", { name: "Giá thêm lựa chọn 1 (đồng)" })).toHaveAttribute("readonly");
    expect(form.getByText(/chỉ xem được giá thêm/)).toBeInTheDocument();
  });
});

async function userClick(element: HTMLElement) {
  element.click();
  await waitFor(() => expect(element).toHaveAttribute("aria-current", "true"));
}
