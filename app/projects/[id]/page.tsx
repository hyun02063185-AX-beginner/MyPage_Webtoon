import Link from "next/link";
import { notFound } from "next/navigation";
import { approveScenarioVersion, archiveProject, createMockScenarioVersion, saveScenarioRevision, updateProject } from "@/app/actions/projects";
import { db } from "@/lib/db";
import { scenarioSchema } from "@/lib/scenario/schema";

export default async function ProjectPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string; error?: string; scenario?: string; scenarioError?: string }> }) {
  const { id } = await params;
  const { saved, error, scenario: scenarioNotice, scenarioError } = await searchParams;
  const project = await db.project.findUnique({
    where: { id },
    include: { selectedScenarioVersion: true, scenarioVersions: { orderBy: { version: "desc" } } },
  });
  if (!project) notFound();
  const update = updateProject.bind(null, project.id);
  const archive = archiveProject.bind(null, project.id);
  const scenario = project.selectedScenarioVersion
    ? scenarioSchema.parse({
      term: project.selectedScenarioVersion.term,
      english: project.selectedScenarioVersion.english ?? undefined,
      title: project.selectedScenarioVersion.title,
      audience: project.selectedScenarioVersion.audience,
      coreMessage: project.selectedScenarioVersion.coreMessage,
      background: project.selectedScenarioVersion.background,
      characterGuide: project.selectedScenarioVersion.characterGuide,
      panels: JSON.parse(project.selectedScenarioVersion.panelsJson),
      finalCaption: project.selectedScenarioVersion.finalCaption,
    })
    : null;
  const generateScenario = createMockScenarioVersion.bind(null, project.id);
  const saveScenario = saveScenarioRevision.bind(null, project.id);
  const approveScenario = scenario ? approveScenarioVersion.bind(null, project.id, project.selectedScenarioVersion!.id) : null;
  return <main className="shell"><p><Link href="/">← 목록</Link></p><h1>{project.concept}</h1>
    {saved && <p role="status">저장했습니다.</p>}{error && <p role="alert">입력값을 확인해 주세요.</p>}
    {scenarioNotice && <p role="status">시나리오 버전이 저장되었습니다.</p>}
    {scenarioError && <p role="alert">시나리오를 저장하거나 승인할 수 없습니다. 현재 상태와 입력값을 확인해 주세요.</p>}
    <section className="card"><h2>기본 정보</h2><form action={update} className="form-grid">
      <label>개념<input name="concept" required defaultValue={project.concept} maxLength={80} /></label>
      <label>대상 독자<input name="audience" required defaultValue={project.audience} maxLength={80} /></label>
      <label>목적<input name="purpose" required defaultValue={project.purpose} maxLength={300} /></label>
      <label>스타일<input name="style" required defaultValue={project.style} maxLength={80} /></label>
      <label>메모<textarea name="memo" defaultValue={project.memo ?? ""} maxLength={500} /></label><button type="submit">저장</button>
    </form><form action={archive}><button className="secondary" type="submit">프로젝트 보관</button></form></section>
    <section className="card" aria-labelledby="scenario-title"><h2 id="scenario-title">4컷 시나리오</h2>
      <p>현재 상태: <strong>{project.status}</strong> · 모든 자동 생성본은 <strong>MOCK</strong>이며 실제 OpenAI 호출은 하지 않습니다.</p>
      {!scenario && <form action={generateScenario}><button type="submit">MOCK 시나리오 만들기</button></form>}
      {scenario && <>
        <p>선택된 버전: v{project.selectedScenarioVersion!.version} · 출처: {project.selectedScenarioVersion!.sourceModel}{project.selectedScenarioVersion!.approvedAt ? " · 서버 승인 기록 있음" : ""}</p>
        {project.status === "SCENARIO_READY" ? <form action={saveScenario} className="form-grid">
          <label>용어<input name="term" required maxLength={80} defaultValue={scenario.term} /></label>
          <label>영문명<input name="english" maxLength={160} defaultValue={scenario.english ?? ""} /></label>
          <label>시나리오 제목<input name="title" required maxLength={160} defaultValue={scenario.title} /></label>
          <label>대상 독자<input name="scenarioAudience" required maxLength={80} defaultValue={scenario.audience} /></label>
          <label>핵심 메시지<textarea name="coreMessage" required maxLength={500} defaultValue={scenario.coreMessage} /></label>
          <label>배경<textarea name="background" required maxLength={300} defaultValue={scenario.background} /></label>
          <label>캐릭터 가이드<textarea name="characterGuide" required maxLength={300} defaultValue={scenario.characterGuide} /></label>
          {scenario.panels.map((panel) => <fieldset key={panel.number}><legend>{panel.number}컷</legend><label>장면<textarea name={`panel-${panel.number}-scene`} required maxLength={500} defaultValue={panel.scene} /></label><label>대사 (줄마다 하나)<textarea name={`panel-${panel.number}-dialogues`} required maxLength={720} defaultValue={panel.dialogues.join("\n")} /></label></fieldset>)}
          <label>최종 캡션<textarea name="finalCaption" required maxLength={240} defaultValue={scenario.finalCaption} /></label>
          <button type="submit">수정본을 새 버전으로 저장</button>
        </form> : <ol>{scenario.panels.map((panel) => <li key={panel.number}><strong>{panel.number}컷: </strong>{panel.scene}<br />대사: {panel.dialogues.join(" / ")}</li>)}</ol>}
        {project.status === "SCENARIO_READY" && approveScenario && <form action={approveScenario}><button type="submit">이 시나리오 버전 승인</button></form>}
      </>}
      {project.scenarioVersions.length > 0 && <p>보존된 시나리오 버전: {project.scenarioVersions.map((version) => `v${version.version}${version.approvedAt ? " (승인)" : ""}`).join(", ")}</p>}
    </section>
  </main>;
}
