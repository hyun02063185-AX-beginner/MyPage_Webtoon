import { expect, test } from "@playwright/test";

test("creates, revises, preserves, and approves a four-panel mock scenario", async ({ page }) => {
  const concept = `시나리오 ${Date.now()}`;
  await page.goto("/");
  await page.getByLabel("개념").fill(concept);
  await page.getByLabel("목적").fill("4컷 시나리오 버전 관리 확인");
  await page.getByRole("button", { name: "프로젝트 만들기" }).click();
  await page.getByRole("link", { name: concept }).click();

  await page.getByRole("button", { name: "MOCK 시나리오 만들기" }).click();
  await expect(page.getByText("선택된 버전: v1")).toBeVisible();
  await expect(page.getByText("MOCK", { exact: true })).toBeVisible();

  await page.getByLabel("대사 (줄마다 하나)").nth(1).fill("수정한 두 번째 컷 대사");
  await page.getByRole("button", { name: "수정본을 새 버전으로 저장" }).click();
  await expect(page.getByText("선택된 버전: v2")).toBeVisible();
  await expect(page.getByText("보존된 시나리오 버전: v2, v1")).toBeVisible();

  await page.getByRole("button", { name: "이 시나리오 버전 승인" }).click();
  await expect(page.getByText("현재 상태:")).toContainText("SCENARIO_APPROVED");
  await expect(page.getByText("서버 승인 기록 있음")).toBeVisible();
});
