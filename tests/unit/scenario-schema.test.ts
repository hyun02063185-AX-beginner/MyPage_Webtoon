import { describe, expect, it } from "vitest";
import { createMockScenario } from "@/lib/scenario/mock";
import { scenarioSchema } from "@/lib/scenario/schema";

const project = {
  concept: "검색 증강 생성",
  audience: "일반 직장인",
  purpose: "답변의 근거를 확인하기",
  style: "친근한 교육용 4컷",
};

describe("Phase 3 scenario contract", () => {
  it("creates and validates exactly four ordered mock panels", () => {
    const scenario = createMockScenario(project);

    expect(scenario.panels).toHaveLength(4);
    expect(scenario.panels.map((panel) => panel.number)).toEqual([1, 2, 3, 4]);
    expect(scenarioSchema.parse(scenario)).toEqual(scenario);
  });

  it("rejects a scenario that does not contain exactly four panels", () => {
    const scenario = createMockScenario(project);
    expect(scenarioSchema.safeParse({ ...scenario, panels: scenario.panels.slice(0, 3) }).success).toBe(false);
  });

  it("rejects panels whose numbers are not ordered", () => {
    const scenario = createMockScenario(project);
    const panels = scenario.panels.map((panel) => ({ ...panel }));
    panels[1].number = 4;
    expect(scenarioSchema.safeParse({ ...scenario, panels }).success).toBe(false);
  });
});
