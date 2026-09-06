"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { importLegacyAsset } from "@/lib/legacy/import";

const legacyReference = z.string().regex(/^LEGACY:[a-f0-9]{64}$/);

/** Imports only server-revalidated opaque legacy references; filenames never reach this action. */
export async function importSelectedLegacyAssets(formData: FormData) {
  const references = [...new Set(formData.getAll("asset").map((value) => String(value)))];
  const valid = z.array(legacyReference).min(1).max(20).safeParse(references);
  if (!valid.success) redirect("/legacy?importError=invalid");

  const importedProjectIds: string[] = [];
  let failed = 0;
  for (const assetRef of valid.data) {
    const result = await importLegacyAsset(assetRef);
    if (result.kind === "imported" || result.kind === "already-imported") importedProjectIds.push(result.projectId);
    else failed += 1;
  }

  const query = new URLSearchParams();
  query.set("imported", String(importedProjectIds.length));
  if (failed) query.set("importFailed", String(failed));
  for (const projectId of importedProjectIds) query.append("project", projectId);
  redirect(`/legacy?${query.toString()}`);
}
