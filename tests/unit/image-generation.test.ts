import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const tx = {
    generationLock: { deleteMany: vi.fn(), create: vi.fn(), delete: vi.fn() },
    project: { findUnique: vi.fn(), update: vi.fn() },
    imageAttempt: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  };
  return {
    tx,
    db: {
      imageAttempt: { findUnique: vi.fn() },
      $transaction: vi.fn(async (callback: (transaction: typeof tx) => unknown) => callback(tx)),
    },
  };
});

vi.mock("@/lib/db", () => ({ db: mocks.db }));

import { createMockImageAttempt } from "@/lib/image/generation";

const approvedProject = {
  id: "project-id",
  status: "SCENARIO_APPROVED",
  concept: "API",
  audience: "일반 직장인",
  purpose: "요청과 응답을 설명",
  style: "교육용 만화",
  imageAttempts: [],
  selectedScenarioVersion: {
    id: "scenario-id",
    term: "API",
    title: "API 설명",
    coreMessage: "요청과 응답",
    background: "일반 식당",
    characterGuide: "일반 직장인",
    panelsJson: JSON.stringify([{ number: 1, scene: "장면", dialogues: ["대사"] }]),
    finalCaption: "정리",
    approvedAt: new Date(),
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.db.imageAttempt.findUnique.mockResolvedValue(null);
  mocks.tx.project.findUnique.mockResolvedValue(approvedProject);
  mocks.tx.imageAttempt.create.mockResolvedValue({ id: "attempt-id" });
  mocks.tx.imageAttempt.findFirst.mockResolvedValue(null);
});

describe("Phase 4 mock generation safety boundary", () => {
  it("returns an existing attempt for the same idempotency key", async () => {
    mocks.db.imageAttempt.findUnique.mockResolvedValue({ id: "old-attempt", status: "READY" });

    await expect(createMockImageAttempt({ projectId: "project-id", idempotencyKey: crypto.randomUUID() }))
      .resolves.toEqual({ kind: "idempotent", attemptId: "old-attempt", status: "READY" });
    expect(mocks.db.$transaction).not.toHaveBeenCalled();
  });

  it("persists an immutable MOCK failure and releases the project for retry", async () => {
    const result = await createMockImageAttempt({ projectId: "project-id", idempotencyKey: crypto.randomUUID(), forceFailure: true });

    expect(result).toEqual({ kind: "created", attemptId: "attempt-id", status: "FAILED" });
    expect(mocks.tx.generationLock.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ projectId: "project-id" }) }));
    expect(mocks.tx.imageAttempt.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      isMock: true,
      requestedModel: "MOCK_PHASE_4",
      scenarioVersionId: "scenario-id",
      promptSnapshot: expect.stringContaining("교육용 AI·AX 개념"),
      promptHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    }) }));
    expect(mocks.tx.imageAttempt.update).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({
      status: "FAILED",
      errorCode: "MOCK_GENERATION_FAILED",
    }) }));
    expect(mocks.tx.generationLock.delete).toHaveBeenCalledWith({ where: { projectId: "project-id" } });
    expect(mocks.tx.project.update).toHaveBeenLastCalledWith({ where: { id: "project-id" }, data: { status: "SCENARIO_APPROVED" } });
  });

  it("rejects image generation before server-recorded scenario approval", async () => {
    mocks.tx.project.findUnique.mockResolvedValue({ ...approvedProject, status: "SCENARIO_READY" });

    await expect(createMockImageAttempt({ projectId: "project-id", idempotencyKey: crypto.randomUUID() }))
      .resolves.toEqual({ kind: "rejected", code: "SCENARIO_NOT_APPROVED" });
    expect(mocks.tx.generationLock.create).not.toHaveBeenCalled();
    expect(mocks.tx.imageAttempt.create).not.toHaveBeenCalled();
  });
});
