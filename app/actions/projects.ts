"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { canTransitionProject, type ProjectStatus } from "@/lib/domain/project-status";
import { createMockScenario } from "@/lib/scenario/mock";
import { scenarioSchema, type Scenario } from "@/lib/scenario/schema";

const projectInput = z.object({
  concept: z.string().trim().min(1).max(80),
  audience: z.string().trim().min(1).max(80),
  purpose: z.string().trim().min(1).max(300),
  style: z.string().trim().min(1).max(80),
  memo: z.string().trim().max(500).optional(),
});

export async function createProject(formData: FormData) {
  const result = projectInput.safeParse(Object.fromEntries(formData));
  if (!result.success) redirect("/?error=invalid-project");
  await db.project.create({ data: result.data });
  redirect("/");
}

export async function updateProject(id: string, formData: FormData) {
  const result = projectInput.safeParse(Object.fromEntries(formData));
  if (!result.success) redirect(`/projects/${id}?error=invalid-project`);
  await db.project.update({ where: { id }, data: result.data });
  redirect(`/projects/${id}?saved=1`);
}

export async function archiveProject(id: string) {
  await db.project.update({ where: { id }, data: { status: "ARCHIVED" } });
  redirect("/");
}

const idInput = z.string().cuid();

function scenarioToDatabaseData(scenario: Scenario) {
  return {
    term: scenario.term,
    english: scenario.english ?? null,
    title: scenario.title,
    audience: scenario.audience,
    coreMessage: scenario.coreMessage,
    background: scenario.background,
    characterGuide: scenario.characterGuide,
    panelsJson: JSON.stringify(scenario.panels),
    finalCaption: scenario.finalCaption,
    sourceModel: "MOCK_PHASE_3",
    sourceResponseId: null,
  };
}

function isProjectStatus(value: string): value is ProjectStatus {
  return ["DRAFT", "SCENARIO_READY", "SCENARIO_APPROVED", "IMAGE_GENERATING", "IMAGE_REVIEW", "APPROVED_FOR_EXPORT", "EXPORTED"].includes(value);
}

async function createScenarioVersion(projectId: string, scenario: Scenario, nextStatus: ProjectStatus) {
  return db.$transaction(async (tx) => {
    const project = await tx.project.findUnique({
      where: { id: projectId },
      select: { id: true, status: true },
    });
    if (!project || !isProjectStatus(project.status) || !canTransitionProject(project.status, nextStatus) && project.status !== nextStatus) {
      throw new Error("SCENARIO_STATE_INVALID");
    }

    const latest = await tx.scenarioVersion.aggregate({
      where: { projectId },
      _max: { version: true },
    });
    const version = (latest._max.version ?? 0) + 1;
    const created = await tx.scenarioVersion.create({
      data: { projectId, version, ...scenarioToDatabaseData(scenario) },
    });
    await tx.project.update({
      where: { id: projectId },
      data: { status: nextStatus, selectedScenarioVersionId: created.id },
    });
    return created;
  });
}

export async function createMockScenarioVersion(id: string) {
  const parsedId = idInput.safeParse(id);
  if (!parsedId.success) redirect("/?error=invalid-project");
  const project = await db.project.findUnique({ where: { id: parsedId.data } });
  if (!project || project.status !== "DRAFT") redirect(`/projects/${id}?scenarioError=state`);

  await createScenarioVersion(project.id, createMockScenario(project), "SCENARIO_READY");
  redirect(`/projects/${project.id}?scenario=generated`);
}

function readScenarioEdit(formData: FormData) {
  const get = (name: string) => String(formData.get(name) ?? "").trim();
  return scenarioSchema.safeParse({
    term: get("term"),
    english: get("english") || undefined,
    title: get("title"),
    audience: get("scenarioAudience"),
    coreMessage: get("coreMessage"),
    background: get("background"),
    characterGuide: get("characterGuide"),
    panels: [1, 2, 3, 4].map((number) => ({
      number,
      scene: get(`panel-${number}-scene`),
      dialogues: get(`panel-${number}-dialogues`).split(/\r?\n/).map((line) => line.trim()).filter(Boolean),
    })),
    finalCaption: get("finalCaption"),
  });
}

export async function saveScenarioRevision(id: string, formData: FormData) {
  const parsedId = idInput.safeParse(id);
  const scenario = readScenarioEdit(formData);
  if (!parsedId.success || !scenario.success) redirect(`/projects/${id}?scenarioError=invalid`);
  const project = await db.project.findUnique({ where: { id: parsedId.data } });
  if (!project || project.status !== "SCENARIO_READY") redirect(`/projects/${id}?scenarioError=state`);

  await createScenarioVersion(project.id, scenario.data, "SCENARIO_READY");
  redirect(`/projects/${project.id}?scenario=saved`);
}

export async function approveScenarioVersion(projectId: string, scenarioVersionId: string) {
  const ids = z.tuple([idInput, idInput]).safeParse([projectId, scenarioVersionId]);
  if (!ids.success) redirect("/?error=invalid-project");

  const [validProjectId, validScenarioVersionId] = ids.data;
  const approved = await db.$transaction(async (tx) => {
    const project = await tx.project.findUnique({ where: { id: validProjectId } });
    const scenario = await tx.scenarioVersion.findFirst({
      where: { id: validScenarioVersionId, projectId: validProjectId },
    });
    if (!project || !scenario || project.status !== "SCENARIO_READY" || project.selectedScenarioVersionId !== scenario.id) {
      return false;
    }
    if (!canTransitionProject("SCENARIO_READY", "SCENARIO_APPROVED")) return false;
    const approvedAt = new Date();
    await tx.scenarioVersion.update({ where: { id: scenario.id }, data: { approvedAt } });
    await tx.project.update({
      where: { id: project.id },
      data: { status: "SCENARIO_APPROVED", selectedScenarioVersionId: scenario.id },
    });
    return true;
  });
  if (!approved) redirect(`/projects/${projectId}?scenarioError=approve`);
  redirect(`/projects/${projectId}?scenario=approved`);
}
