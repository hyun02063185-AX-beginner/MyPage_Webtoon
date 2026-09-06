import Link from "next/link";
import { notFound } from "next/navigation";
import { archiveProject, updateProject } from "@/app/actions/projects";
import { db } from "@/lib/db";

export default async function ProjectPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string; error?: string }> }) {
  const { id } = await params;
  const { saved, error } = await searchParams;
  const project = await db.project.findUnique({ where: { id } });
  if (!project) notFound();
  const update = updateProject.bind(null, project.id);
  const archive = archiveProject.bind(null, project.id);
  return <main className="shell"><p><Link href="/">← 목록</Link></p><h1>{project.concept}</h1>
    {saved && <p role="status">저장했습니다.</p>}{error && <p role="alert">입력값을 확인해 주세요.</p>}
    <section className="card"><h2>기본 정보</h2><form action={update} className="form-grid">
      <label>개념<input name="concept" required defaultValue={project.concept} maxLength={80} /></label>
      <label>대상 독자<input name="audience" required defaultValue={project.audience} maxLength={80} /></label>
      <label>목적<input name="purpose" required defaultValue={project.purpose} maxLength={300} /></label>
      <label>스타일<input name="style" required defaultValue={project.style} maxLength={80} /></label>
      <label>메모<textarea name="memo" defaultValue={project.memo ?? ""} maxLength={500} /></label><button type="submit">저장</button>
    </form><form action={archive}><button className="secondary" type="submit">프로젝트 보관</button></form></section>
  </main>;
}
