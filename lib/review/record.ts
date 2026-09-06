import { db } from "@/lib/db";
import { canTransitionProject } from "@/lib/domain/project-status";
import { reviewFlags, reviewResult, type ImageReviewInput } from "@/lib/review/validation";

export type RecordReviewResult =
  | { kind: "recorded"; result: "PASSED" | "REJECTED"; exportBlockedByMock: boolean }
  | { kind: "rejected"; code: "ATTEMPT_NOT_REVIEWABLE" | "REVIEW_ALREADY_RECORDED" };

/** Records a human decision. The client never chooses the project status or review result. */
export async function recordImageReview(imageAttemptId: string, input: ImageReviewInput): Promise<RecordReviewResult> {
  return db.$transaction(async (tx) => {
    const attempt = await tx.imageAttempt.findUnique({
      where: { id: imageAttemptId },
      include: { project: true, imageReview: true },
    });
    if (!attempt || attempt.status !== "READY" || attempt.project.status !== "IMAGE_REVIEW") {
      return { kind: "rejected", code: "ATTEMPT_NOT_REVIEWABLE" };
    }
    if (attempt.imageReview) return { kind: "rejected", code: "REVIEW_ALREADY_RECORDED" };

    const result = reviewResult(input);
    const flags = reviewFlags(input);
    await tx.imageReview.create({
      data: {
        imageAttemptId: attempt.id,
        result,
        panelChecksJson: JSON.stringify(input.panelChecks),
        notes: input.rejectionReason ?? null,
        ...flags,
      },
    });

    const exportBlockedByMock = result === "PASSED" && attempt.isMock;
    if (result === "REJECTED") {
      if (!canTransitionProject("IMAGE_REVIEW", "SCENARIO_APPROVED")) {
        return { kind: "rejected", code: "ATTEMPT_NOT_REVIEWABLE" };
      }
      await tx.project.update({ where: { id: attempt.projectId }, data: { status: "SCENARIO_APPROVED" } });
    } else if (!exportBlockedByMock) {
      if (!canTransitionProject("IMAGE_REVIEW", "APPROVED_FOR_EXPORT")) {
        return { kind: "rejected", code: "ATTEMPT_NOT_REVIEWABLE" };
      }
      await tx.project.update({ where: { id: attempt.projectId }, data: { status: "APPROVED_FOR_EXPORT" } });
    }
    return { kind: "recorded", result, exportBlockedByMock };
  });
}
