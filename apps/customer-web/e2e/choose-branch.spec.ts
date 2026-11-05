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

  // The menu placeholder is titled with the chosen Branch's name, the first line of its card.
  await expect(page).toHaveURL(new RegExp(`${href}$`));
  const title = (await page.getByRole("heading", { level: 1 }).innerText()).trim();
  expect(card.startsWith(title)).toBe(true);
  const code = decodeURIComponent(href?.split("/")[2] ?? "");
  expect((await context.cookies()).find((c) => c.name === "hayi.branch")?.value).toBe(encodeURIComponent(code));

  await page.getByRole("link", { name: "Chọn chi nhánh khác" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Bạn lấy nước ở đâu?" })).toBeVisible();
});
