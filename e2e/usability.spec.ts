import { expect, test } from "@playwright/test";

test.describe("workflow guidance on a narrow screen", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("keeps the creation path and final-export location visible without horizontal overflow", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "처음 만드는 방법" })).toBeVisible();
    await expect(page.getByText(/완성본 미리보기·내보내기/)).toBeVisible();
    await expect(page.getByText("MOCK 결과는 실제 웹툰이 아니며 최종 내보내기에 사용할 수 없습니다.")).toBeVisible();
    expect(await page.locator(".compact-workflow").evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length)).toBe(1);
    expect(await page.locator("body").evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
