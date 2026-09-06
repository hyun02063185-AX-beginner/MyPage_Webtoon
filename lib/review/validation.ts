import { z } from "zod";

export const panelIssueTypes = ["NORMAL", "TYPO", "MISSING", "CROPPED", "LAYOUT", "OTHER"] as const;
export type PanelIssueType = (typeof panelIssueTypes)[number];

export const panelCheckSchema = z.object({
  panelNumber: z.number().int().min(1).max(4),
  issueType: z.enum(panelIssueTypes),
});

export const imageReviewInputSchema = z.object({
  panelChecks: z.array(panelCheckSchema).length(4),
  rejectionReason: z.string().trim().max(1000).optional(),
  finalConfirmation: z.boolean(),
}).superRefine((value, context) => {
  const numbers = value.panelChecks.map((check) => check.panelNumber);
  if (new Set(numbers).size !== 4 || ![1, 2, 3, 4].every((number) => numbers.includes(number))) {
    context.addIssue({ code: "custom", path: ["panelChecks"], message: "1~4컷을 모두 판정해 주세요." });
  }

  const hasIssue = value.panelChecks.some((check) => check.issueType !== "NORMAL");
  if (hasIssue && !value.rejectionReason) {
    context.addIssue({ code: "custom", path: ["rejectionReason"], message: "반려 사유를 입력해 주세요." });
  }
  if (!hasIssue && !value.finalConfirmation) {
    context.addIssue({ code: "custom", path: ["finalConfirmation"], message: "전체 통과를 명시적으로 확인해 주세요." });
  }
});

export type ImageReviewInput = z.infer<typeof imageReviewInputSchema>;

export function reviewResult(input: ImageReviewInput): "PASSED" | "REJECTED" {
  return input.panelChecks.every((check) => check.issueType === "NORMAL") ? "PASSED" : "REJECTED";
}

export function reviewFlags(input: ImageReviewInput) {
  const types = new Set(input.panelChecks.map((check) => check.issueType));
  return {
    typoFound: types.has("TYPO"),
    missingText: types.has("MISSING"),
    croppedText: types.has("CROPPED"),
    layoutIssue: types.has("LAYOUT"),
    contentIssue: types.has("OTHER"),
  };
}
