import { describe, expect, it } from "vitest";
import { imageReviewInputSchema, reviewFlags, reviewResult } from "@/lib/review/validation";

const allNormal = {
  panelChecks: [1, 2, 3, 4].map((panelNumber) => ({ panelNumber, issueType: "NORMAL" as const })),
  finalConfirmation: true,
};

describe("image review validation", () => {
  it("requires an explicit human confirmation before all-normal panels pass", () => {
    expect(imageReviewInputSchema.safeParse({ ...allNormal, finalConfirmation: false }).success).toBe(false);
    const parsed = imageReviewInputSchema.parse(allNormal);
    expect(reviewResult(parsed)).toBe("PASSED");
  });

  it("requires a written rejection reason and records issue flags", () => {
    const rejected = {
      ...allNormal,
      panelChecks: allNormal.panelChecks.map((check) => check.panelNumber === 2 ? { ...check, issueType: "CROPPED" as const } : check),
      finalConfirmation: false,
    };
    expect(imageReviewInputSchema.safeParse(rejected).success).toBe(false);
    const parsed = imageReviewInputSchema.parse({ ...rejected, rejectionReason: "2컷 대사가 잘렸습니다." });
    expect(reviewResult(parsed)).toBe("REJECTED");
    expect(reviewFlags(parsed)).toMatchObject({ croppedText: true, typoFound: false });
  });
});
