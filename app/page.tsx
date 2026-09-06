import { getRuntimeReadiness } from "@/lib/config/runtime";
import { createProject } from "@/app/actions/projects";
import { db } from "@/lib/db";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ q?: string; error?: string }> }) {
  const readiness = getRuntimeReadiness();
  const { q = "", error } = await searchParams;
  const query = q.trim();
  const [projects, terms] = await Promise.all([
    db.project.findMany({ orderBy: { updatedAt: "desc" }, take: 12 }),
    db.term.findMany({ where: query ? { OR: [{ term: { contains: query } }, { definition: { contains: query } }] } : undefined, orderBy: { term: "asc" }, take: 20 }),
  ]);

  return (
    <main className="shell">
      <p className="eyebrow">PRIVATE CREATION TOOL · PHASE 1</p>
      <h1>AI·AX 용어 4컷 만화 생성기</h1>
      <p className="intro">시나리오·프롬프트·검수 이력을 보존해 MyPage 갤러리용 결과물을 준비합니다.</p>
      <section aria-labelledby="setup-title" className="card">
        <h2 id="setup-title">로컬 환경 상태</h2>
        <p data-testid="ai-mode">AI 생성 모드: <strong>{readiness.modeLabel}</strong></p>
        <p>{readiness.message}</p>
        <p className="note">이 단계에서는 실제 OpenAI 호출과 이미지 생성이 비활성화되어 있습니다.</p>
      </section>
      <section aria-labelledby="project-title" className="card">
        <h2 id="project-title">새 웹툰 프로젝트</h2>
        {error && <p role="alert">필수 항목을 모두 입력해 주세요.</p>}
        <form action={createProject} className="form-grid">
          <label>개념<input name="concept" required maxLength={80} /></label>
          <label>대상 독자<input name="audience" required defaultValue="일반 직장인" maxLength={80} /></label>
          <label>목적<input name="purpose" required maxLength={300} /></label>
          <label>스타일<input name="style" required defaultValue="친근한 교육용 4컷" maxLength={80} /></label>
          <label>메모<textarea name="memo" maxLength={500} /></label>
          <button type="submit">프로젝트 만들기</button>
        </form>
        <p>최근 프로젝트: {projects.length}개</p>
      </section>
      <section aria-labelledby="terms-title" className="card">
        <h2 id="terms-title">신규 선정 AI·AX 용어</h2>
        <form><label>검색<input name="q" defaultValue={query} placeholder="용어 또는 설명" /></label><button type="submit">검색</button></form>
        <p>{query ? `“${query}” 검색 결과` : "신규 선정 목록"}: {terms.length}개 표시</p>
        <ul>{terms.map((term) => <li key={term.id}><strong>{term.term}</strong> · {term.category}<br />{term.definition}</li>)}</ul>
      </section>
    </main>
  );
}
