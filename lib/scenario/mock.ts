import type { Project } from "@prisma/client";
import { scenarioSchema, type Scenario } from "@/lib/scenario/schema";

/**
 * 비용 없는 Phase 3용 어댑터입니다. LIVE 모드에서도 호출하지 않으며,
 * 반환값은 실제 모델 응답과 같은 Zod 계약으로 검증됩니다.
 */
export function createMockScenario(project: Pick<Project, "concept" | "audience" | "purpose" | "style">): Scenario {
  return scenarioSchema.parse({
    term: project.concept,
    title: `${project.concept}를 쉽게 이해하는 4컷 이야기`,
    audience: project.audience,
    coreMessage: `${project.concept}는 ${project.purpose}에 도움이 되는 핵심 개념입니다.`,
    background: "일반적인 사무실의 친근한 교육 상황",
    characterGuide: `${project.style} 톤의 일반적인 직장인 캐릭터. 실존 인물, 브랜드, 로고를 사용하지 않습니다.`,
    panels: [
      { number: 1, scene: `${project.concept}가 필요한 일상 업무 상황을 보여줍니다.`, dialogues: ["이 일을 더 쉽게 이해할 방법이 있을까요?"] },
      { number: 2, scene: `${project.concept}의 핵심 역할을 비유로 설명합니다.`, dialogues: ["핵심 원리를 한 단계씩 살펴보겠습니다."] },
      { number: 3, scene: `업무에서 ${project.concept}를 적용하는 모습을 보여줍니다.`, dialogues: ["그래서 업무가 더 명확해지는군요."] },
      { number: 4, scene: `${project.concept}의 효과를 한 줄로 정리합니다.`, dialogues: ["이제 핵심을 기억할 수 있겠습니다."] },
    ],
    finalCaption: `${project.concept}: ${project.purpose}`,
  });
}
