export const projectStatuses = ["DRAFT", "SCENARIO_READY", "SCENARIO_APPROVED", "IMAGE_GENERATING", "IMAGE_REVIEW", "APPROVED_FOR_EXPORT", "EXPORTED"] as const;
export type ProjectStatus = (typeof projectStatuses)[number];

const allowedTransitions: Record<ProjectStatus, readonly ProjectStatus[]> = {
  DRAFT: ["SCENARIO_READY"],
  SCENARIO_READY: ["SCENARIO_APPROVED"],
  SCENARIO_APPROVED: ["IMAGE_GENERATING"],
  // A failed attempt is retained, then safely returns to the already-approved scenario for retry.
  IMAGE_GENERATING: ["SCENARIO_APPROVED", "IMAGE_REVIEW"],
  // A human rejection keeps its immutable review and returns to the approved scenario for regeneration.
  IMAGE_REVIEW: ["SCENARIO_APPROVED", "APPROVED_FOR_EXPORT"],
  APPROVED_FOR_EXPORT: ["EXPORTED"],
  EXPORTED: [],
};

export function canTransitionProject(from: ProjectStatus, to: ProjectStatus): boolean {
  return allowedTransitions[from].includes(to);
}
