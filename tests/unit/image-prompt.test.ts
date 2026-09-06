import { describe, expect, it } from "vitest";
import { buildImagePrompt, hashPrompt } from "@/lib/image/prompt";

const project = { concept: "API", audience: "일반 직장인", purpose: "요청과 응답을 쉽게 설명", style: "따뜻한 교육용 만화" };
const scenario = {
  term: "API",
  title: "API로 주문하기",
  coreMessage: "정해진 규칙으로 요청과 응답을 주고받습니다.",
  background: "일반적인 식당",
  characterGuide: "일반적인 직장인 캐릭터",
  panelsJson: JSON.stringify([
    { number: 1, scene: "주문을 고민한다", dialogues: ["메뉴를 볼까요?"] },
    { number: 2, scene: "주문을 보낸다", dialogues: ["주문합니다."] },
    { number: 3, scene: "주방이 응답한다", dialogues: ["준비하겠습니다."] },
    { number: 4, scene: "음식을 받는다", dialogues: ["요청과 응답입니다."] },
  ]),
  finalCaption: "API는 연결 규칙입니다.",
};

describe("Phase 4 image prompt snapshot", () => {
  it("combines the approved scenario and safety constraints into a stable prompt", () => {
    const prompt = buildImagePrompt(project, scenario);
    expect(prompt).toContain("4개 패널을 읽기 순서대로 명확히 구분합니다.");
    expect(prompt).toContain("특정 작가의 화풍");
    expect(prompt).toContain("1컷 장면: 주문을 고민한다");
    expect(hashPrompt(prompt)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashPrompt(prompt)).toBe(hashPrompt(prompt));
  });
});
