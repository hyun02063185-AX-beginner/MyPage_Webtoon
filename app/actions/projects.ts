"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";

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
