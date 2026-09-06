import { describe, expect, it } from "vitest";
import { canTransitionProject } from "@/lib/domain/project-status";

describe("project state transitions", () => {
  it("allows only the server-defined next state", () => {
    expect(canTransitionProject("DRAFT", "SCENARIO_READY")).toBe(true);
    expect(canTransitionProject("DRAFT", "IMAGE_GENERATING")).toBe(false);
  });
});
