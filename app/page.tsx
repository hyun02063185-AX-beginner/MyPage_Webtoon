import { getRuntimeReadiness } from "@/lib/config/runtime";
import { createProject } from "@/app/actions/projects";
import { db } from "@/lib/db";
import Link from "next/link";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ q?: string; projectQ?: string; status?: string; error?: string }> }) {
  const readiness = getRuntimeReadiness();
  const { q = "", projectQ = "", status = "ACTIVE", error } = await searchParams;
  const query = q.trim();
  const projectQuery = projectQ.trim();
  const projectWhere = {
    ...(status === "ALL" ? {} : { status: status === "ARCHIVED" ? "ARCHIVED" : { not: "ARCHIVED" } }),
    ...(projectQuery ? { OR: [{ concept: { contains: projectQuery } }, { audience: { contains: projectQuery } }] } : {}),
  };
  const [projects, terms] = await Promise.all([
    db.project.findMany({ where: projectWhere, orderBy: { updatedAt: "desc" }, take: 30 }),
    db.term.findMany({ where: query ? { OR: [{ term: { contains: query } }, { definition: { contains: query } }] } : undefined, orderBy: { term: "asc" }, take: 20 }),
  ]);

  return (
    <main className="shell">
      <p className="eyebrow">PRIVATE CREATION TOOL</p>
      <h1>AI·AX 용어 4컷 만화 생성기</h1>
      <p className="intro">시나리오·프롬프트·검수 이력을 보존해 MyPage 갤러리용 결과물을 준비합니다.</p>
      <section className="card" aria-labelledby="start-title">
        <h2 id="start-title">처음 만드는 방법</h2>
        <ol className="workflow compact-workflow" aria-label="웹툰 제작 흐름">
          <li className="workflow-current"><strong>1. 새 프로젝트 만들기</strong><span>아래에서 개념과 대상 독자를 입력합니다.</span></li>
          <li><strong>2. 4컷 시나리오 승인</strong><span>프로젝트 화면에서 내용을 확인·수정합니다.</span></li>
          <li><strong>3. 이미지 생성과 사람 검수</strong><span>예상 대사와 결과를 컷별로 비교합니다.</span></li>
          <li><strong>4. 완성본 미리보기·내보내기</strong><span>검수 통과 뒤 프로젝트 화면의 5단계에서 WebP·JSON을 준비합니다.</span></li>
        </ol>
        <p className="note">현재는 비용 없는 MOCK 모드입니다. MOCK 결과는 실제 웹툰이 아니며 최종 내보내기에 사용할 수 없습니다.</p>
      </section>
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
        <form className="search-form"><label>프로젝트 검색<input name="projectQ" defaultValue={projectQuery} placeholder="개념 또는 대상 독자" /></label><label>상태<select name="status" defaultValue={status}><option value="ACTIVE">진행 중</option><option value="ARCHIVED">보관됨</option><option value="ALL">전체</option></select></label><button type="submit">찾기</button></form>
        <ul>{projects.map((project) => <li key={project.id}><Link href={`/projects/${project.id}`}>{project.concept}</Link> · {project.status}<br />{project.audience} 대상</li>)}</ul>
      </section>
      <section aria-labelledby="terms-title" className="card">
        <h2 id="terms-title">신규 선정 AI·AX 용어</h2>
        <form><label>검색<input name="q" defaultValue={query} placeholder="용어 또는 설명" /></label><button type="submit">검색</button></form>
        <p>{query ? `“${query}” 검색 결과` : "신규 선정 목록"}: {terms.length}개 표시</p>
        <ul>{terms.map((term) => <li key={term.id}><strong>{term.term}</strong> · {term.category}<br />{term.definition}</li>)}</ul>
      </section>
      <section aria-labelledby="legacy-title" className="card">
        <h2 id="legacy-title">과거 웹툰 후보 검토</h2>
        <p>기존 `backup_images/` 원본은 새 프로젝트와 분리해 읽기 전용으로 검토합니다. 프롬프트 없는 과거 자산은 추정하지 않으며, 자동 이관하지 않습니다.</p>
        <Link href="/legacy">과거 이미지 후보 검토하기 →</Link>
      </section>
    </main>
  );
}
