import { expect, test } from "@playwright/test";

test("reviews legacy candidates without importing them, then prepares only an explicit selection", async ({ page }) => {
  await page.goto("/legacy");

  await expect(page.getByRole("heading", { name: "과거 웹툰 후보 검토" })).toBeVisible();
  await expect(page.getByText(/프롬프트: 없음 \(promptUnavailable=true\)/)).toBeVisible();
  const firstCandidate = page.locator(".legacy-asset").first();
  await expect(firstCandidate).toBeVisible();
  await expect(firstCandidate.locator("img")).toBeVisible();

  await firstCandidate.getByRole("checkbox", { name: "이 후보를 이관 준비 목록에 포함" }).check();
  await page.getByRole("button", { name: "선택한 후보로 이관 준비 계획 보기" }).click();

  await expect(page.getByText("1개 후보를 명시적으로 선택했습니다. 아직 실제 이관은 실행하지 않았습니다.")).toBeVisible();
  await expect(page.getByText(/상태: PENDING_EXPLICIT_IMPORT/)).toBeVisible();
});
