import { type Page, expect, test } from "@playwright/test";

/** Set E2E_SCREENSHOTS=<dir> to keep one screenshot per screen (design comparison in the PR). */
async function snap(page: Page, name: string) {
  const dir = process.env.E2E_SCREENSHOTS;
  if (dir) await page.screenshot({ path: `${dir}/${name}.png`, fullPage: true });
}

/** #31: the customer sees the ACTIVE Branches and chooses one (D3a screen 1). Needs one ACTIVE Branch (README). */
test("Customer: chooses a Branch and reaches its menu", async ({ page, context }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Bạn lấy nước ở đâu?" })).toBeVisible();

  const branches = page.getByRole("list", { name: "Chi nhánh" });
  const first = branches.getByRole("link").first();
  await expect(first).toBeVisible();
  await expect(first).toContainText(/Đang mở|Tạm đóng/);
  await expect(first).toContainText(/Lấy sớm nhất \d{2}:\d{2} hôm nay|Hôm nay hết nhận đơn/);
  await snap(page, "1-choose-branch");

  const card = await first.innerText();
  const href = await first.getAttribute("href");
  await first.click();

  // #51 (D3a screen 2): the menu is titled "Menu <Branch>", the Branch's name being the first line of its card.
  await expect(page).toHaveURL(new RegExp(`${href}$`));
  const title = (await page.getByRole("heading", { level: 1 }).textContent())?.trim() ?? "";
  expect(title.startsWith("Menu ")).toBe(true);
  expect(card.startsWith(title.slice("Menu ".length))).toBe(true);
  const code = decodeURIComponent(href?.split("/")[2] ?? "");
  expect((await context.cookies()).find((c) => c.name === "hayi.branch")?.value).toBe(encodeURIComponent(code));

  // Products by Category with a bar to jump to each, or the empty state when the Branch sells nothing yet.
  const bar = page.getByRole("navigation", { name: "Danh mục" });
  const empty = page.getByText(/Chi nhánh chưa có món nào đang bán/);
  await expect(bar.or(empty)).toBeVisible();
  if (await bar.isVisible()) {
    const jump = bar.getByRole("link").first();
    const anchor = (await jump.getAttribute("href")) ?? "";
    await jump.click();
    await expect(page).toHaveURL(new RegExp(`${anchor}$`));
    await expect(page.locator(anchor)).toBeInViewport();
  }
  await snap(page, "2-menu");

  await page.getByRole("link", { name: /^Lấy tại .*Đổi chi nhánh$/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Bạn lấy nước ở đâu?" })).toBeVisible();
});
