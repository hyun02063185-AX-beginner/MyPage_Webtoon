import { expect, test } from "@playwright/test";

test("shows the private tool setup screen with AI disabled", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "AI·AX 용어 4컷 만화 생성기" })).toBeVisible();
  await expect(page.getByTestId("ai-mode")).toContainText("OFF");
});
