import { type Page, expect, test } from "@playwright/test";

/**
 * Option library (D3d screen 27, FE #45) happy path against a mocked API (no backend): edit a group
 * with a min/max error, add an item, create a group. Set SHOTS_DIR to save the screenshots used in the PR.
 */

const me = {
  userId: "u-o",
  email: "owner@hayi.vn",
  displayName: "Ngọc Hà",
  mfaEnrolled: true,
  storeRoles: ["OWNER"],
  storePermissions: ["BRANCH_VIEW", "BRANCH_MANAGE", "STAFF_VIEW", "CATALOG_VIEW", "CATALOG_MANAGE", "CATALOG_PRICE_MANAGE"],
  branches: [],
};

type Item = { optionItemId: string; code: string; name: string; defaultExtraPrice: number; isDefaultSelected: boolean; status: string; sortOrder: number };
type Group = {
  optionGroupId: string;
  code: string;
  name: string;
  selectionType: string;
  minSelect: number;
  maxSelect: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  items: Item[];
};

const item = (id: string, code: string, name: string, price: number, sortOrder: number, extra: Partial<Item> = {}): Item => ({
  optionItemId: id,
  code,
  name,
  defaultExtraPrice: price,
  isDefaultSelected: false,
  status: "ACTIVE",
  sortOrder,
  ...extra,
});
const group = (id: string, code: string, name: string, selectionType: string, min: number, max: number, items: Item[], extra: Partial<Group> = {}): Group => ({
  optionGroupId: id,
  code,
  name,
  selectionType,
  minSelect: min,
  maxSelect: max,
  status: "ACTIVE",
  createdAt: "2026-11-01T03:00:00Z",
  updatedAt: "2026-11-01T03:00:00Z",
  version: 3,
  items,
  ...extra,
});

function initial(): Group[] {
  return [
    group("sugar", "SUGAR", "Mức đường", "SINGLE", 1, 1, [
      item("s100", "S100", "100%", 0, 1, { isDefaultSelected: true }),
      item("s70", "S70", "70%", 0, 2),
      item("s50", "S50", "50%", 0, 3),
      item("s30", "S30", "30%", 0, 4),
      item("s0", "S0", "Không đường", 0, 5),
    ]),
    group("ice", "ICE", "Lượng đá", "SINGLE", 1, 1, [
      item("i100", "ICE-100", "Đá bình thường", 0, 1, { isDefaultSelected: true }),
      item("i50", "ICE-50", "Ít đá", 0, 2),
      item("i0", "ICE-0", "Không đá", 0, 3),
      item("ihot", "HOT", "Nóng", 0, 4),
    ]),
    group("topping", "TOPPING", "Topping", "MULTIPLE", 0, 3, [
      item("t1", "TRAN-CHAU-HK", "Trân châu hoàng kim", 10000, 1),
      item("t2", "THACH-MATCHA", "Thạch matcha", 8000, 2),
      item("t3", "KEM-CHEESE", "Kem cheese", 12000, 3),
      item("t4", "PUDDING", "Pudding trứng", 10000, 4, { status: "ARCHIVED" }),
    ]),
    group("shot", "SHOT", "Thêm shot espresso", "MULTIPLE", 0, 2, [item("e1", "SHOT-1", "1 shot", 15000, 1)], { status: "ARCHIVED" }),
  ];
}

async function mockApi(page: Page) {
  let groups = initial();
  const answer = (route: Parameters<Parameters<Page["route"]>[1]>[0], next: Group, status = 200) => {
    groups = groups.some((g) => g.optionGroupId === next.optionGroupId)
      ? groups.map((g) => (g.optionGroupId === next.optionGroupId ? next : g))
      : [...groups, next];
    return route.fulfill({ status, json: next, headers: { ETag: `"v${next.version}"` } });
  };
  await page.route("**/api/backoffice/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/.*\/api\/backoffice\/v1/, "");
    const key = `${request.method()} ${path}`;
    const topping = () => groups.find((g) => g.optionGroupId === "topping")!;
    if (key === "GET /auth/me") return route.fulfill({ json: me });
    if (key === "GET /branches") return route.fulfill({ json: { items: [] } });
    if (key === "GET /option-groups") return route.fulfill({ json: { items: groups } });
    if (key === "PATCH /option-groups/topping") {
      const body = request.postDataJSON() as Partial<Group>;
      if ((body.minSelect ?? topping().minSelect) > (body.maxSelect ?? topping().maxSelect)) {
        return route.fulfill({ status: 422, contentType: "application/problem+json", body: JSON.stringify({ status: 422, code: "OPTION_GROUP_MINMAX_INVALID" }) });
      }
      return answer(route, { ...topping(), ...body, version: topping().version + 1 });
    }
    if (key === "POST /option-groups/topping/items") {
      const body = request.postDataJSON() as Item;
      const g = topping();
      return answer(route, { ...g, items: [...g.items, { ...body, optionItemId: "t5", status: "ACTIVE", sortOrder: 5 }], version: g.version + 1 });
    }
    if (key === "POST /option-groups") {
      const body = request.postDataJSON() as Group;
      const created = { ...group("milk", body.code, body.name, body.selectionType, body.minSelect, body.maxSelect, []), version: 0 };
      created.items = body.items.map((i, n) => ({ ...i, optionItemId: `m${n}`, status: "ACTIVE", sortOrder: n + 1 }));
      return answer(route, created, 201);
    }
    return route.fulfill({ status: 404, json: { status: 404, code: "NOT_FOUND" } });
  });
}

async function shot(page: Page, name: string) {
  if (!process.env.SHOTS_DIR) return;
  // Let colour transitions (150 ms) finish so the shot shows the settled state.
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${process.env.SHOTS_DIR}/${name}.png`, fullPage: true });
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await mockApi(page);
});

test("Owner edits a group, adds an item and creates a group", async ({ page }) => {
  await page.goto("/admin/options");
  await expect(page.getByRole("heading", { level: 1, name: "Tuỳ chọn" })).toBeVisible();
  await page.getByRole("button", { name: /Topping/ }).click();
  const form = page.getByRole("form", { name: "Topping" });
  await expect(form.getByLabel("Tên nhóm (khách thấy)")).toHaveValue("Topping");

  await form.getByLabel("Chọn tối thiểu").fill("4");
  await form.getByRole("button", { name: "Lưu nhóm" }).click();
  await expect(form.getByLabel("Chọn tối đa")).toBeFocused();
  await expect(form.getByText("Tối đa phải lớn hơn hoặc bằng tối thiểu (4).")).toBeVisible();
  await shot(page, "27-minmax");

  await form.getByLabel("Chọn tối thiểu").fill("0");
  await form.getByRole("button", { name: "Thêm lựa chọn" }).click();
  await form.getByLabel("Tên lựa chọn 5").fill("Trân châu trắng");
  await expect(form.getByLabel("Mã lựa chọn 5")).toHaveValue("TRAN-CHAU-TRANG");
  await form.getByLabel("Giá thêm lựa chọn 5 (đồng)").fill("10000");
  await form.getByRole("button", { name: "Lưu nhóm" }).click();
  await expect(page.getByText("Đã lưu nhóm.")).toBeVisible();
  await expect(form.getByLabel("Chọn tối đa")).not.toHaveAttribute("aria-invalid", "true");  await expect(form.getByRole("row", { name: /TRAN-CHAU-TRANG/ })).toContainText("Đang dùng");
  await expect(form.getByLabel("Giá thêm lựa chọn 5 (đồng)")).toHaveValue(/^10\.000\s₫$/);
  await shot(page, "27-topping");

  await page.getByRole("button", { name: "Tạo nhóm" }).click();
  const create = page.getByRole("form", { name: "Nhóm mới" });
  await create.getByLabel("Mã nhóm").fill("MILK");
  await create.getByLabel("Tên nhóm (khách thấy)").fill("Loại sữa");
  await create.getByRole("button", { name: "Thêm lựa chọn" }).click();
  await create.getByLabel("Tên lựa chọn 1").fill("Sữa tươi");
  await create.getByLabel("Giá thêm lựa chọn 1 (đồng)").fill("0");
  await create.getByRole("button", { name: "Thêm lựa chọn" }).click();
  await create.getByLabel("Tên lựa chọn 2").fill("Sữa yến mạch");
  await create.getByLabel("Giá thêm lựa chọn 2 (đồng)").fill("8000");
  await shot(page, "27-create");
  await create.getByRole("button", { name: "Tạo nhóm" }).click();
  await expect(page.getByText("Đã tạo nhóm “Loại sữa”.")).toBeVisible();
  await expect(page).toHaveURL(/group=milk/);
});
