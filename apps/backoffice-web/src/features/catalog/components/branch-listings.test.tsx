import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Me } from "../../../lib/scope";
import { json, problem } from "../../../test/fake-api";
import { aBranch, renderAdmin } from "../../branch/test/render-admin";
import type { BranchListing, BranchListingRow, OptionItemListing } from "../api/listings";
import { aListing, aListingRow, listingResponse } from "../test/listings";
import { aGroup } from "../test/option-groups";
import { aProduct, productResponse } from "../test/products";

const PATH = "/branches/b-q1/listings";

const manager: Me = {
  userId: "u-m",
  email: "minh@hayi.vn",
  displayName: "Trần Minh",
  mfaEnrolled: true,
  storeRoles: [],
  storePermissions: [],
  branches: [{ branchId: "b-q1", roles: ["MANAGER"], permissions: ["BRANCH_VIEW", "CATALOG_VIEW", "BRANCH_LISTING_MANAGE"] }],
};
const viewer: Me = { ...manager, branches: [{ branchId: "b-q1", roles: ["STAFF"], permissions: ["BRANCH_VIEW", "CATALOG_VIEW"] }] };

const draft: BranchListingRow = { productId: "p-dx", productCode: "MATCHA-DX", name: "Matcha Đá Xay", status: "DRAFT", listing: null };

/** Rows kept by the fake server; every command answers the row with the next listing version (AD2). */
function server(initial: BranchListingRow[] = [aListingRow(), draft]) {
  let rows = initial;
  const queries: URLSearchParams[] = [];
  const put = (productId: string, change: (listing: BranchListing | null) => BranchListing) => {
    const row = rows.find((r) => r.productId === productId)!;
    const next = { ...row, listing: { ...change(row.listing), version: (row.listing?.version ?? 0) + 1 } };
    rows = rows.map((r) => (r.productId === productId ? next : r));
    return listingResponse(next);
  };
  const variantPut = (productId: string, variantId: string) => (body: unknown, request: Request) => {
    const current = rows.find((r) => r.productId === productId)!.listing!;
    if (request.headers.get("If-Match") !== `"v${current.version}"`) return problem(412, "VERSION_CONFLICT");
    const input = body as { price: number | null; availabilityState: "AVAILABLE" | "NOT_AVAILABLE" };
    return put(productId, (listing) => ({
      ...listing!,
      variants: listing!.variants.map((v) =>
        v.variantId === variantId ? { ...v, price: input.price, effectivePrice: input.price ?? v.basePrice, availabilityState: input.availabilityState } : v,
      ),
    }));
  };
  return {
    queries,
    handlers: {
      "GET /branches": () => json({ items: [aBranch({ branchId: "b-q1", name: "Quận 1 · Lê Lợi" })] }),
      "GET /branches/b-q1/listings": (_body: unknown, request: Request) => {
        queries.push(new URL(request.url).searchParams);
        return json({ items: rows, page: { number: 0, size: 20, totalItems: rows.length, totalPages: 1 } });
      },
      "PUT /branches/b-q1/listings/p-dx": (body: unknown) =>
        put("p-dx", () => ({
          availabilityState: (body as { availabilityState: "AVAILABLE" }).availabilityState,
          version: 0,
          variants: [{ variantId: "v-dx", name: "M", basePrice: 55000, price: null, effectivePrice: 55000, availabilityState: "AVAILABLE" }],
        })),
      "PUT /branches/b-q1/listings/p-latte": (body: unknown) =>
        put("p-latte", (listing) => ({ ...listing!, availabilityState: (body as { availabilityState: "NOT_AVAILABLE" }).availabilityState })),
      "PUT /branches/b-q1/listings/p-latte/variants/v-m": variantPut("p-latte", "v-m"),
      "PUT /branches/b-q1/listings/p-latte/variants/v-l": variantPut("p-latte", "v-l"),
    },
  };
}

function ifMatchOf(api: ReturnType<typeof renderAdmin>["api"], route: string) {
  return api.calls.filter((c) => c.route === route).map((c) => c.headers.get("If-Match"));
}

const row = (name: RegExp) => within(screen.getByRole("row", { name }));
const nbsp = (text: string | null) => text?.replace(/\s/g, " ");

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Branch listings (D3d screen 29)", () => {
  it("is a link under Quản lý chi nhánh and lists Products with their Branch price and state", async () => {
    renderAdmin(PATH, server().handlers, manager);

    expect(await screen.findByRole("heading", { level: 1, name: "Món bán tại chi nhánh" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Món bán tại chi nhánh" })).toHaveAttribute("aria-current", "page");
    const latte = await screen.findByRole("row", { name: /Matcha Latte/ });
    expect(nbsp(latte.textContent)).toContain("M 48.000 ₫ · L 55.000 ₫ (M giá riêng)");
    expect(within(latte).getByText("Đang bán")).toBeInTheDocument();
    const dx = row(/Matcha Đá Xay/);
    expect(dx.getByText("Món nháp")).toBeInTheDocument();
    expect(dx.getByText("Chưa bán")).toBeInTheDocument();
    expect(dx.getByRole("button", { name: /^Bật bán/ })).toBeInTheDocument();
  });

  it("sells a Product with If-Match v0 and stops selling one with its version", async () => {
    const fake = server();
    const { api, user } = renderAdmin(PATH, fake.handlers, manager);
    await screen.findByRole("row", { name: /Matcha Đá Xay/ });

    await user.click(row(/Matcha Đá Xay/).getByRole("button", { name: /^Bật bán/ }));
    expect(await screen.findByText(/Đã bật bán Matcha Đá Xay tại/)).toBeInTheDocument();
    expect(api.bodyOf("PUT /branches/b-q1/listings/p-dx")).toEqual({ availabilityState: "AVAILABLE" });
    expect(ifMatchOf(api, "PUT /branches/b-q1/listings/p-dx")).toEqual(['"v0"']);
    expect(row(/Matcha Đá Xay/).getByText("Đang bán")).toBeInTheDocument();

    await user.click(row(/Matcha Latte/).getByRole("button", { name: /^Gỡ bán/ }));
    expect(await screen.findByText(/Đã gỡ bán Matcha Latte tại/)).toBeInTheDocument();
    expect(ifMatchOf(api, "PUT /branches/b-q1/listings/p-latte")).toEqual(['"v3"']);
    expect(row(/Matcha Latte/).getByRole("button", { name: /^Bật bán/ })).toBeInTheDocument();
  });

  it("saves Branch prices per size, one request per changed size with the latest version", async () => {
    const fake = server();
    const { api, user } = renderAdmin(PATH, fake.handlers, manager);
    await user.click(await screen.findByRole("button", { name: "Mở rộng Matcha Latte" }));

    const form = within(screen.getByRole("form", { name: "Giá Matcha Latte tại chi nhánh" }));
    await user.clear(form.getByRole("textbox", { name: "Giá size M tại chi nhánh (đồng)" }));
    await user.type(form.getByRole("textbox", { name: "Giá size L tại chi nhánh (đồng)" }), "57000");
    await user.click(form.getByRole("button", { name: "Lưu giá" }));

    expect(await screen.findByText(/Đã lưu giá của Matcha Latte tại .*sau khoảng một phút/)).toBeInTheDocument();
    expect(api.bodyOf("PUT /branches/b-q1/listings/p-latte/variants/v-m")).toEqual({ price: null, availabilityState: "AVAILABLE" });
    expect(api.bodyOf("PUT /branches/b-q1/listings/p-latte/variants/v-l")).toEqual({ price: 57000, availabilityState: "AVAILABLE" });
    expect(ifMatchOf(api, "PUT /branches/b-q1/listings/p-latte/variants/v-m")).toEqual(['"v3"']);
    expect(ifMatchOf(api, "PUT /branches/b-q1/listings/p-latte/variants/v-l")).toEqual(['"v4"']);
    expect(await screen.findByText((text) => nbsp(text) === "M 45.000 ₫ · L 57.000 ₫ (L giá riêng)")).toBeInTheDocument();
  });

  it("checks typed prices before sending", async () => {
    const { api, user } = renderAdmin(PATH, server().handlers, manager);
    await user.click(await screen.findByRole("button", { name: "Mở rộng Matcha Latte" }));
    const price = screen.getByRole("textbox", { name: "Giá size L tại chi nhánh (đồng)" });
    await user.type(price, "abc");
    await user.click(screen.getByRole("button", { name: "Lưu giá" }));
    expect(price).toHaveAccessibleDescription("Nhập giá đầy đủ, ví dụ 48.000, hoặc để trống để dùng giá gốc.");
    expect(price).toHaveFocus();
    expect(api.calls.some((c) => c.route.includes("/variants/"))).toBe(false);
  });

  it("keeps typed prices over a newer version; the save gets 412, and after Tải lại it saves on the new version", async () => {
    const fake = server();
    const { api, user } = renderAdmin(PATH, fake.handlers, manager);
    await user.click(await screen.findByRole("button", { name: "Mở rộng Matcha Latte" }));
    const large = screen.getByRole("textbox", { name: "Giá size L tại chi nhánh (đồng)" });
    await user.type(large, "57000");

    // The listing moves on meanwhile (here: the row's own Gỡ bán, v3 → v4); what is typed stays.
    await user.click(screen.getByRole("button", { name: "Gỡ bán Matcha Latte" }));
    expect(await screen.findByText(/Đã gỡ bán Matcha Latte/)).toBeInTheDocument();
    expect(nbsp((large as HTMLInputElement).value)).toBe("57.000 ₫");

    await user.click(screen.getByRole("button", { name: "Lưu giá" }));
    expect(await screen.findByText(/Món vừa được người khác cập nhật/)).toBeInTheDocument();
    expect(ifMatchOf(api, "PUT /branches/b-q1/listings/p-latte/variants/v-l")).toEqual(['"v3"']);

    await user.click(screen.getByRole("button", { name: "Tải lại" }));
    await waitFor(() => expect(fake.queries.length).toBeGreaterThan(1));
    expect(nbsp(screen.getByRole<HTMLInputElement>("textbox", { name: "Giá size L tại chi nhánh (đồng)" }).value)).toBe("57.000 ₫");
    await user.click(screen.getByRole("button", { name: "Lưu giá" }));
    expect(await screen.findByText(/Đã lưu giá của Matcha Latte/)).toBeInTheDocument();
    expect(ifMatchOf(api, "PUT /branches/b-q1/listings/p-latte/variants/v-l")).toEqual(['"v3"', '"v4"']);
  });

  it("on 412 VERSION_CONFLICT offers to reload", async () => {
    const fake = server();
    const { user } = renderAdmin(PATH, { ...fake.handlers, "PUT /branches/b-q1/listings/p-latte": () => problem(412, "VERSION_CONFLICT") }, manager);
    await user.click(await screen.findByRole("button", { name: "Gỡ bán Matcha Latte" }));
    expect(await screen.findByText(/Món vừa được người khác cập nhật/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Tải lại" }));
    await waitFor(() => expect(fake.queries.length).toBeGreaterThan(1));
  });

  it("searches by name or code in the URL", async () => {
    const fake = server();
    const { user, router } = renderAdmin(PATH, fake.handlers, manager);
    await user.type(await screen.findByRole("searchbox", { name: "Tìm món" }), "latte");
    await waitFor(() => expect(router.state.location.search).toEqual({ q: "latte" }));
    await waitFor(() => expect(fake.queries.at(-1)?.get("q")).toBe("latte"));
  });

  it("is read-only without BRANCH_LISTING_MANAGE", async () => {
    const { user } = renderAdmin(PATH, server([aListingRow({ listing: aListing() }), draft]).handlers, viewer);
    await screen.findByRole("row", { name: /Matcha Latte/ });
    expect(screen.queryByRole("button", { name: /^Bật bán/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Gỡ bán/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Mở rộng Matcha Latte" }));
    expect(screen.getByRole("textbox", { name: "Giá size M tại chi nhánh (đồng)" })).toHaveAttribute("readonly");
    expect(screen.queryByRole("button", { name: "Lưu giá" })).not.toBeInTheDocument();
  });
});

describe("Branch option prices (D3d screen 29, FE #65)", () => {
  const product = aProduct({
    productId: "p-latte",
    name: "Matcha Latte",
    optionGroups: [
      { optionGroupId: "g-topping", code: "TOPPING", name: "Topping", selectionType: "MULTIPLE", minSelect: 0, maxSelect: 3, minSelectOverride: null, maxSelectOverride: null, sortOrder: 0 },
    ],
    optionItemOverrides: [
      { optionItemId: "i-pearl", extraPriceOverride: 12000, isHidden: false },
      { optionItemId: "i-jelly", extraPriceOverride: null, isHidden: true },
    ],
  });

  function optionServer(listings: OptionItemListing[] = []) {
    const fake = server();
    let current = listings;
    return {
      ...fake,
      handlers: {
        ...fake.handlers,
        "GET /products/p-latte": () => productResponse(product),
        "GET /option-groups": () => json({ items: [aGroup()] }),
        "GET /branches/b-q1/option-item-listings": () => json({ items: current }),
        "PUT /branches/b-q1/option-item-listings/i-pearl": (body: unknown) => {
          const old = current.find((l) => l.optionItemId === "i-pearl");
          const saved: OptionItemListing = {
            optionItemId: "i-pearl",
            extraPrice: (body as { extraPrice: number | null }).extraPrice,
            availabilityState: "AVAILABLE",
            version: (old?.version ?? 0) + 1,
          };
          current = [...current.filter((l) => l.optionItemId !== "i-pearl"), saved];
          return json(saved);
        },
      },
    };
  }

  it("lists the Product's option items with their Product price and saves a Branch price with v0", async () => {
    const fake = optionServer();
    const { api, user } = renderAdmin(PATH, fake.handlers, manager);
    await user.click(await screen.findByRole("button", { name: "Mở rộng Matcha Latte" }));

    const options = within(await screen.findByRole("table", { name: "Tuỳ chọn của Matcha Latte" }));
    const pearl = within(options.getByRole("row", { name: /Trân châu/ }));
    expect(pearl.getByText("Lựa chọn của nhóm Topping")).toBeInTheDocument();
    expect(nbsp(pearl.getByText(/^\+12\.000/).textContent)).toBe("+12.000 ₫");
    // Hidden at the Product: not offered here.
    expect(options.queryByRole("row", { name: /Thạch matcha/ })).not.toBeInTheDocument();
    expect(screen.getByText(/áp cho mọi món dùng lựa chọn này/)).toBeInTheDocument();

    await user.type(pearl.getByRole("textbox", { name: "Giá thêm Trân châu tại chi nhánh (đồng)" }), "11000");
    await user.click(screen.getByRole("button", { name: "Lưu giá" }));

    expect(await screen.findByText(/Đã lưu giá của Matcha Latte/)).toBeInTheDocument();
    expect(api.bodyOf("PUT /branches/b-q1/option-item-listings/i-pearl")).toEqual({ extraPrice: 11000 });
    expect(ifMatchOf(api, "PUT /branches/b-q1/option-item-listings/i-pearl")).toEqual(['"v0"']);
    expect(api.calls.some((c) => c.route.includes("/variants/"))).toBe(false);
  });

  it("clears a Branch price with null and the item's own version", async () => {
    const fake = optionServer([{ optionItemId: "i-pearl", extraPrice: 11000, availabilityState: "AVAILABLE", version: 4 }]);
    const { api, user } = renderAdmin(PATH, fake.handlers, manager);
    await user.click(await screen.findByRole("button", { name: "Mở rộng Matcha Latte" }));
    const price = await screen.findByRole("textbox", { name: "Giá thêm Trân châu tại chi nhánh (đồng)" });
    expect(nbsp((price as HTMLInputElement).value)).toBe("11.000 ₫");

    await user.clear(price);
    await user.click(screen.getByRole("button", { name: "Lưu giá" }));
    expect(await screen.findByText(/Đã lưu giá của Matcha Latte/)).toBeInTheDocument();
    expect(api.bodyOf("PUT /branches/b-q1/option-item-listings/i-pearl")).toEqual({ extraPrice: null });
    expect(ifMatchOf(api, "PUT /branches/b-q1/option-item-listings/i-pearl")).toEqual(['"v4"']);
  });

  it("is read-only without BRANCH_LISTING_MANAGE", async () => {
    const { user } = renderAdmin(PATH, optionServer().handlers, viewer);
    await user.click(await screen.findByRole("button", { name: "Mở rộng Matcha Latte" }));
    expect(await screen.findByRole("textbox", { name: "Giá thêm Trân châu tại chi nhánh (đồng)" })).toHaveAttribute("readonly");
  });
});
