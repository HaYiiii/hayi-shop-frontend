import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { json, problem } from "../../../test/fake-api";
import { owner, renderAdmin } from "../../branch/test/render-admin";
import type { CategoryTree } from "../api/categories";
import { aCategory, aTree, categoryResponse } from "../test/categories";

const catalogOwner = { ...owner, storePermissions: [...owner.storePermissions, "CATALOG_VIEW", "CATALOG_MANAGE"] };
const catalogViewer = { ...owner, storePermissions: ["BRANCH_VIEW", "CATALOG_VIEW"] };

/** The tree the fake server holds; `GET /categories?includeArchived=true` answers it. */
function server(initial: CategoryTree = aTree({ archived: true })) {
  let tree = initial;
  return {
    set(next: CategoryTree) {
      tree = next;
    },
    handlers: {
      "GET /branches": () => json({ items: [] }),
      "GET /categories": () => json(tree),
    },
  };
}

function headerOf(api: ReturnType<typeof renderAdmin>["api"], route: string, name: string) {
  return api.calls.findLast((c) => c.route === route)?.headers.get(name);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Category tree (D3d screen 20)", () => {
  it("is a flat Danh mục link under Quản trị and shows the active tree in menu order", async () => {
    renderAdmin("/admin/categories", server().handlers, catalogOwner);

    expect(await screen.findByRole("heading", { level: 1, name: "Danh mục" })).toBeInTheDocument();
    const nav = within(screen.getByRole("region", { name: "Quản trị" }));
    expect(nav.getByRole("link", { name: "Danh mục" })).toHaveAttribute("aria-current", "page");
    expect(await screen.findByText("2 nhóm · 2 danh mục con · tối đa 2 cấp")).toBeInTheDocument();

    const roots = screen.getByRole("list", { name: "Danh mục" });
    expect([...roots.children].map((li) => li.firstElementChild?.textContent)).toEqual([
      expect.stringContaining("Trà"),
      expect.stringContaining("Sữa chua"),
    ]);
    const children = within(screen.getByRole("list", { name: "Danh mục con của Trà" }));
    expect(children.getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      expect.stringContaining("Trà vải"),
      expect.stringContaining("Trà đào"),
    ]);
    expect(screen.queryByText("Món cũ")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Chuyển Trà lên" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("button", { name: "Chuyển Sữa chua xuống" })).toHaveAttribute("aria-disabled", "true");
  });

  it("shows archived Categories on request, without actions", async () => {
    const { router, user } = renderAdmin("/admin/categories", server().handlers, catalogOwner);

    await user.click(await screen.findByRole("button", { name: "Xem đã lưu trữ (1)" }));

    expect(await screen.findByText("Món cũ")).toBeInTheDocument();
    expect(router.state.location.search).toEqual({ archived: 1 });
    expect(screen.getByText("Đã lưu trữ")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sửa Món cũ" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Ẩn đã lưu trữ" }));
    expect(screen.queryByText("Món cũ")).not.toBeInTheDocument();
  });

  it("hides every action without CATALOG_MANAGE", async () => {
    renderAdmin("/admin/categories", server().handlers, catalogViewer);

    expect(await screen.findByText("Trà vải")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Chuyển / })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Sửa / })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Lưu trữ / })).not.toBeInTheDocument();
    expect(screen.queryByRole("form", { name: "Thêm danh mục" })).not.toBeInTheDocument();
  });

  it("moves a Category with the up button and keeps the keyboard on it", async () => {
    const s = server();
    const { api, user } = renderAdmin(
      "/admin/categories",
      {
        ...s.handlers,
        "PUT /categories/order": () => {
          s.set(aTree({ milkFirst: true, archived: true }));
          return json(aTree({ milkFirst: true }));
        },
      },
      catalogOwner,
    );

    const up = await screen.findByRole("button", { name: "Chuyển Sữa chua lên" });
    await user.click(up);

    expect(api.bodyOf("PUT /categories/order")).toEqual({ parentId: null, categoryIds: ["c-milk", "c-tea"] });
    expect(headerOf(api, "PUT /categories/order", "If-Match")).toBeNull();
    await waitFor(() => expect(screen.getByRole("button", { name: "Chuyển Sữa chua lên" })).toHaveAttribute("aria-disabled", "true"));
    expect(screen.getByRole("button", { name: "Chuyển Sữa chua lên" })).toHaveFocus();
    expect(screen.getByText("Đã chuyển Sữa chua lên, vị trí 1.")).toBeInTheDocument();
  });

  it("on CATALOG_CATEGORY_ORDER_STALE says so and shows the reloaded tree", async () => {
    const s = server();
    const { user } = renderAdmin(
      "/admin/categories",
      { ...s.handlers, "PUT /categories/order": () => problem(409, "CATALOG_CATEGORY_ORDER_STALE") },
      catalogOwner,
    );

    await user.click(await screen.findByRole("button", { name: "Chuyển Sữa chua lên" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("vừa được thay đổi ở nơi khác");
    expect(screen.getByRole("button", { name: "Chuyển Trà lên" })).toHaveAttribute("aria-disabled", "true");
  });

  it("adds a Category: the slug follows the name, the new one appears last", async () => {
    const s = server();
    const { api, user } = renderAdmin(
      "/admin/categories",
      {
        ...s.handlers,
        "POST /categories": () => {
          const cake = aCategory({ categoryId: "c-cake", name: "Bánh ngọt", slug: "banh-ngot", sortOrder: 3 });
          s.set(aTree({ extraRoot: cake, archived: true }));
          return categoryResponse(cake, 201);
        },
      },
      catalogOwner,
    );

    const form = within(await screen.findByRole("form", { name: "Thêm danh mục" }));
    await user.type(form.getByLabelText("Tên"), "Bánh ngọt");
    expect(form.getByLabelText("Đường dẫn (slug)")).toHaveValue("banh-ngot");
    await user.click(form.getByRole("button", { name: "Thêm danh mục" }));

    expect(api.bodyOf("POST /categories")).toEqual({ name: "Bánh ngọt", slug: "banh-ngot" });
    expect(await form.findByRole("status")).toHaveTextContent("Đã thêm “Bánh ngọt” vào cuối nhóm.");
    expect(form.getByLabelText("Tên")).toHaveValue("");
    expect(await screen.findByText("3 nhóm · 2 danh mục con · tối đa 2 cấp")).toBeInTheDocument();
  });

  it("shows CATALOG_SLUG_TAKEN and CATALOG_CATEGORY_DEPTH_EXCEEDED under their fields", async () => {
    let answer = problem(409, "CATALOG_SLUG_TAKEN");
    const { user } = renderAdmin(
      "/admin/categories",
      { ...server().handlers, "POST /categories": () => answer },
      catalogOwner,
    );

    const form = within(await screen.findByRole("form", { name: "Thêm danh mục" }));
    await user.type(form.getByLabelText("Tên"), "Trà");
    await user.click(form.getByRole("button", { name: "Thêm danh mục" }));

    const slug = form.getByLabelText("Đường dẫn (slug)");
    await waitFor(() => expect(slug).toHaveAccessibleDescription(/đã được dùng, kể cả bởi danh mục đã lưu trữ/));
    expect(slug).toHaveAttribute("aria-invalid", "true");
    expect(slug).toHaveFocus();

    answer = problem(422, "CATALOG_CATEGORY_DEPTH_EXCEEDED");
    await user.clear(slug);
    await user.type(slug, "tra-moi");
    await user.click(form.getByRole("button", { name: "Thêm danh mục" }));

    const parent = form.getByLabelText("Danh mục cha");
    await waitFor(() => expect(parent).toHaveAccessibleDescription(/Chỉ chọn được danh mục gốc làm danh mục cha/));
    expect(slug).not.toHaveAttribute("aria-invalid");
  });

  it("checks the slug before sending", async () => {
    const { api, user } = renderAdmin("/admin/categories", server().handlers, catalogOwner);

    const form = within(await screen.findByRole("form", { name: "Thêm danh mục" }));
    await user.type(form.getByLabelText("Tên"), "Trà");
    await user.clear(form.getByLabelText("Đường dẫn (slug)"));
    await user.type(form.getByLabelText("Đường dẫn (slug)"), "Trà Sữa");
    await user.click(form.getByRole("button", { name: "Thêm danh mục" }));

    expect(form.getByLabelText("Đường dẫn (slug)")).toHaveAccessibleDescription(/Chỉ dùng chữ thường không dấu/);
    expect(api.calls.some((c) => c.route === "POST /categories")).toBe(false);
  });

  it("edits a Category with If-Match and only the changed fields", async () => {
    const s = server();
    const { api, user } = renderAdmin(
      "/admin/categories",
      {
        ...s.handlers,
        "PATCH /categories/c-tea-peach": () => {
          s.set(aTree({ archived: true }));
          return categoryResponse(aCategory({ categoryId: "c-tea-peach", parentId: null, version: 3 }));
        },
      },
      catalogOwner,
    );

    await user.click(await screen.findByRole("button", { name: "Sửa Trà đào" }));
    const form = within(screen.getByRole("form", { name: "Sửa “Trà đào”" }));
    expect(form.getByLabelText("Danh mục cha")).toHaveValue("c-tea");
    await user.selectOptions(form.getByLabelText("Danh mục cha"), "");
    await user.click(form.getByRole("button", { name: "Lưu thay đổi" }));

    expect(api.bodyOf("PATCH /categories/c-tea-peach")).toEqual({ parentId: null });
    expect(headerOf(api, "PATCH /categories/c-tea-peach", "If-Match")).toBe('"v2"');
    expect(await screen.findByRole("form", { name: "Thêm danh mục" })).toBeInTheDocument();
  });

  it("explains DEPTH_EXCEEDED when a root with children is moved under another", async () => {
    const { user } = renderAdmin(
      "/admin/categories",
      { ...server().handlers, "PATCH /categories/c-tea": () => problem(422, "CATALOG_CATEGORY_DEPTH_EXCEEDED") },
      catalogOwner,
    );

    await user.click(await screen.findByRole("button", { name: "Sửa Trà" }));
    const form = within(screen.getByRole("form", { name: "Sửa “Trà”" }));
    expect(within(form.getByLabelText("Danh mục cha")).queryByRole("option", { name: "Trà" })).not.toBeInTheDocument();
    await user.selectOptions(form.getByLabelText("Danh mục cha"), "c-milk");
    await user.click(form.getByRole("button", { name: "Lưu thay đổi" }));

    await waitFor(() =>
      expect(form.getByLabelText("Danh mục cha")).toHaveAccessibleDescription(/“Trà” đang có danh mục con/),
    );
  });

  it("on VERSION_CONFLICT keeps what was typed, reloads, and saves against the new version", async () => {
    const s = server();
    let conflict = true;
    const { api, user } = renderAdmin(
      "/admin/categories",
      {
        ...s.handlers,
        "PATCH /categories/c-milk": () => {
          if (conflict) return problem(412, "VERSION_CONFLICT");
          return categoryResponse(aCategory({ categoryId: "c-milk", name: "Sữa chua dẻo", version: 7 }));
        },
      },
      catalogOwner,
    );

    await user.click(await screen.findByRole("button", { name: "Sửa Sữa chua" }));
    const form = within(screen.getByRole("form", { name: "Sửa “Sữa chua”" }));
    await user.clear(form.getByLabelText("Tên"));
    await user.type(form.getByLabelText("Tên"), "Sữa chua dẻo");
    await user.click(form.getByRole("button", { name: "Lưu thay đổi" }));

    expect(await form.findByRole("alert")).toHaveTextContent("vẫn còn trong form");
    // Someone else's edit moved the version to 6.
    const newer = aTree({ archived: true });
    newer.items[1] = { ...newer.items[1]!, version: 6 };
    s.set(newer);
    await user.click(form.getByRole("button", { name: "Tải lại" }));

    await waitFor(() => expect(api.calls.filter((c) => c.route === "GET /categories")).toHaveLength(2));
    expect(form.getByLabelText("Tên")).toHaveValue("Sữa chua dẻo");
    conflict = false;
    await user.click(form.getByRole("button", { name: "Lưu thay đổi" }));
    await waitFor(() => expect(headerOf(api, "PATCH /categories/c-milk", "If-Match")).toBe('"v6"'));
  });

  it("archives after confirming, with If-Match", async () => {
    const s = server();
    const { api, user } = renderAdmin(
      "/admin/categories",
      {
        ...s.handlers,
        "POST /categories/c-milk/archive": () => {
          s.set(aTree({ withoutMilk: true, archived: true }));
          return categoryResponse(aCategory({ categoryId: "c-milk", status: "ARCHIVED", version: 6 }));
        },
      },
      catalogOwner,
    );

    await user.click(await screen.findByRole("button", { name: "Lưu trữ Sữa chua…" }));
    const dialog = within(screen.getByRole("dialog", { name: "Lưu trữ “Sữa chua”?" }));
    await user.click(dialog.getByRole("button", { name: "Lưu trữ danh mục" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(headerOf(api, "POST /categories/c-milk/archive", "If-Match")).toBe('"v5"');
    await waitFor(() => expect(screen.queryByText("Sữa chua")).not.toBeInTheDocument());
  });

  it("on CATALOG_CATEGORY_IN_USE closes the dialog, explains above the tree and marks the row", async () => {
    const { user } = renderAdmin(
      "/admin/categories",
      { ...server().handlers, "POST /categories/c-tea/archive": () => problem(409, "CATALOG_CATEGORY_IN_USE") },
      catalogOwner,
    );

    await user.click(await screen.findByRole("button", { name: "Lưu trữ Trà…" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Lưu trữ danh mục" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Chưa lưu trữ được “Trà”: còn 2 danh mục con chưa lưu trữ, và có thể còn món dùng danh mục này làm danh mục chính.",
    );
    expect(screen.getByText("tra").closest("div.grid")).toHaveClass("bg-danger-soft");
  });

  it("on VERSION_CONFLICT while archiving offers a reload", async () => {
    const { api, user } = renderAdmin(
      "/admin/categories",
      { ...server().handlers, "POST /categories/c-milk/archive": () => problem(412, "VERSION_CONFLICT") },
      catalogOwner,
    );

    await user.click(await screen.findByRole("button", { name: "Lưu trữ Sữa chua…" }));
    const dialog = within(screen.getByRole("dialog"));
    await user.click(dialog.getByRole("button", { name: "Lưu trữ danh mục" }));

    expect(await dialog.findByRole("alert")).toHaveTextContent("vừa được người khác cập nhật");
    await user.click(dialog.getByRole("button", { name: "Tải lại" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(api.calls.filter((c) => c.route === "GET /categories")).toHaveLength(2);
  });
});
