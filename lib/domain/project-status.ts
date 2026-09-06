export const projectStatuses = ["DRAFT", "SCENARIO_READY", "SCENARIO_APPROVED", "IMAGE_GENERATING", "IMAGE_REVIEW", "APPROVED_FOR_EXPORT", "EXPORTED"] as const;
export type ProjectStatus = (typeof projectStatuses)[number];

const allowedTransitions: Record<ProjectStatus, readonly ProjectStatus[]> = {
  DRAFT: ["SCENARIO_READY"],
  SCENARIO_READY: ["SCENARIO_APPROVED"],
  SCENARIO_APPROVED: ["IMAGE_GENERATING"],
  IMAGE_GENERATING: ["IMAGE_REVIEW"],
  IMAGE_REVIEW: ["APPROVED_FOR_EXPORT"],
  APPROVED_FOR_EXPORT: ["EXPORTED"],
  EXPORTED: [],
};

export function canTransitionProject(from: ProjectStatus, to: ProjectStatus): boolean {
  return allowedTransitions[from].includes(to);
}
