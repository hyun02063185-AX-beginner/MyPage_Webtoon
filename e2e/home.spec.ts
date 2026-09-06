import { expect, test } from "@playwright/test";

test("shows the private tool setup screen with AI disabled", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "AI·AX 용어 4컷 만화 생성기" })).toBeVisible();
  await expect(page.getByTestId("ai-mode")).toContainText("OFF");
});

test("creates a project and finds a curated term without AI", async ({ page }) => {
  const concept = `E2E 용어 ${Date.now()}`;
  await page.goto("/");
  await page.getByLabel("개념").fill(concept);
  await page.getByLabel("목적").fill("검색과 프로젝트 흐름 확인");
  await page.getByRole("button", { name: "프로젝트 만들기" }).click();
  await expect(page.getByRole("link", { name: concept })).toBeVisible();
  await page.getByLabel("검색", { exact: true }).fill("생성형 AI");
  await page.getByRole("button", { name: "검색" }).click();
  await expect(page.getByText("생성형 AI", { exact: true })).toBeVisible();
});
