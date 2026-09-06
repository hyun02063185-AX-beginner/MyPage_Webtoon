import { createHash } from "node:crypto";

export type ApprovedScenarioForPrompt = {
  term: string;
  title: string;
  coreMessage: string;
  background: string;
  characterGuide: string;
  panelsJson: string;
  finalCaption: string;
};

export type ProjectForPrompt = {
  concept: string;
  audience: string;
  purpose: string;
  style: string;
};

export function buildImagePrompt(project: ProjectForPrompt, scenario: ApprovedScenarioForPrompt, correctionInstruction?: string): string {
  const panels = JSON.parse(scenario.panelsJson) as Array<{ number: number; scene: string; dialogues: string[] }>;
  const panelInstructions = panels.map((panel) => `${panel.number}컷 장면: ${panel.scene}\n대사: ${panel.dialogues.join(" / ")}`).join("\n\n");

  return [
    "교육용 AI·AX 개념을 설명하는 한국어 4컷 웹툰을 제작합니다.",
    `개념: ${project.concept} (${scenario.term})`,
    `대상 독자: ${project.audience}`,
    `교육 목적: ${project.purpose}`,
    `시각 스타일: ${project.style}`,
    `시나리오 제목: ${scenario.title}`,
    `핵심 메시지: ${scenario.coreMessage}`,
    `배경: ${scenario.background}`,
    `캐릭터 가이드: ${scenario.characterGuide}`,
    "4개 패널을 읽기 순서대로 명확히 구분합니다.",
    panelInstructions,
    `최종 캡션: ${scenario.finalCaption}`,
    ...(correctionInstruction ? [`수정 재생성 지시: ${correctionInstruction}`] : []),
    "실존 인물, 특정 작가의 화풍, 기존 캐릭터, 브랜드 로고, 타사 서비스 화면, 개인정보를 포함하지 마세요.",
    "한국어 대사는 짧고 읽기 쉽게 배치하며, 중요한 글자가 가장자리에서 잘리지 않게 하세요.",
  ].join("\n\n");
}

export function hashPrompt(prompt: string): string {
  return createHash("sha256").update(prompt, "utf8").digest("hex");
}
