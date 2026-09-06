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
  await expect(page.getByText(/출처: MOCK_PHASE_3/)).toBeVisible();

  await page.getByLabel("대사 (줄마다 하나)").nth(1).fill("수정한 두 번째 컷 대사");
  await page.getByRole("button", { name: "수정본을 새 버전으로 저장" }).click();
  await expect(page.getByText("선택된 버전: v2")).toBeVisible();
  await expect(page.getByText("보존된 시나리오 버전: v2, v1")).toBeVisible();

  await page.getByRole("button", { name: "이 시나리오 버전 승인" }).click();
  await expect(page.getByText("현재 상태:")).toContainText("SCENARIO_APPROVED");
  await expect(page.getByText("서버 승인 기록 있음")).toBeVisible();

  await expect(page.getByText("실제 호출 전 프롬프트·옵션 미리보기")).toBeVisible();
  await page.getByRole("button", { name: "MOCK 이미지 생성 시도 기록" }).click();
  await expect(page.getByText("MOCK 이미지 생성 시도가 준비됨 상태로 기록되었습니다.")).toBeVisible();
  await expect(page.getByText("현재 상태:")).toContainText("IMAGE_REVIEW");
  await expect(page.getByText("MOCK — 실제 이미지 없음").first()).toBeVisible();

  await page.getByLabel("2컷 판정").selectOption("TYPO");
  await page.getByLabel("반려 사유 (문제가 한 컷이라도 있으면 필수)").fill("두 번째 컷의 한글 대사에 오타가 있습니다.");
  await page.getByRole("button", { name: "검수 결과 저장" }).click();
  await expect(page.getByText("검수 반려를 기록했습니다.")).toBeVisible();
  await expect(page.getByText("현재 상태:")).toContainText("SCENARIO_APPROVED");
  await expect(page.getByRole("heading", { name: "반려된 이미지 수정 재생성" })).toBeVisible();

  await page.getByLabel("수정 지시").fill("두 번째 컷의 한국어 대사를 정확히 고쳐 주세요.");
  await page.getByRole("button", { name: "반려 사유로 MOCK 재생성" }).click();
  await expect(page.getByText("현재 상태:")).toContainText("IMAGE_REVIEW");
  await page.getByLabel("네 컷 모두 정상이며 사람이 최종 확인했습니다.").check();
  await page.getByRole("button", { name: "검수 결과 저장" }).click();
  await expect(page.getByText("검수표는 통과로 저장했지만 MOCK 결과이므로 최종 내보내기는 계속 차단됩니다.")).toBeVisible();
  await expect(page.getByText("MOCK 검수 통과 — 최종 내보내기 차단")).toBeVisible();
  await page.getByLabel("slug (영문 소문자·숫자·하이픈)").fill(`mock-export-blocked-${Date.now()}`);
  await page.getByLabel("갤러리 제목").fill("MOCK 내보내기 차단 확인");
  await page.getByLabel("이미지 설명 (imageAlt)").fill("실제 이미지가 없는 MOCK 결과입니다.");
  await page.getByLabel("해설 문단 (빈 줄로 문단 구분)").fill("이 결과는 실제 내보내기 대상이 아닙니다.");
  await page.getByRole("button", { name: "메타데이터 저장·검증" }).click();
  await expect(page.getByText("갤러리 메타데이터를 저장했습니다.")).toBeVisible();
  await expect(page.getByRole("button", { name: "WebP + JSON 묶음 내보내기" })).toBeDisabled();
});
