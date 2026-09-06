import Link from "next/link";
import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { approveScenarioVersion, archiveProject, createMockScenarioVersion, generateMockImageAttempt, saveScenarioRevision, updateProject } from "@/app/actions/projects";
import { db } from "@/lib/db";
import { getMockPromptPreview } from "@/lib/image/generation";
import { scenarioSchema } from "@/lib/scenario/schema";

export default async function ProjectPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string; error?: string; scenario?: string; scenarioError?: string; generation?: string; generationError?: string }> }) {
  const { id } = await params;
  const { saved, error, scenario: scenarioNotice, scenarioError, generation, generationError } = await searchParams;
  const project = await db.project.findUnique({
    where: { id },
    include: { selectedScenarioVersion: true, scenarioVersions: { orderBy: { version: "desc" } }, imageAttempts: { orderBy: { createdAt: "desc" } }, generationLock: true },
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
  const generateMockImage = generateMockImageAttempt.bind(null, project.id);
  const promptPreview = scenario && project.selectedScenarioVersion?.approvedAt
    ? getMockPromptPreview(project, project.selectedScenarioVersion)
    : null;
  return <main className="shell"><p><Link href="/">← 목록</Link></p><h1>{project.concept}</h1>
    {saved && <p role="status">저장했습니다.</p>}{error && <p role="alert">입력값을 확인해 주세요.</p>}
    {scenarioNotice && <p role="status">시나리오 버전이 저장되었습니다.</p>}
    {scenarioError && <p role="alert">시나리오를 저장하거나 승인할 수 없습니다. 현재 상태와 입력값을 확인해 주세요.</p>}
    {generation && <p role="status">MOCK 이미지 생성 시도가 {generation === "ready" ? "준비됨" : generation === "failed" ? "실패로 기록됨" : "기존 요청으로 확인됨"} 상태로 기록되었습니다. 실제 이미지나 비용은 발생하지 않았습니다.</p>}
    {generationError && <p role="alert">이미지 생성을 시작할 수 없습니다. 승인 상태, 중복 요청 또는 입력값을 확인해 주세요.</p>}
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
    <section className="card" aria-labelledby="image-generation-title"><h2 id="image-generation-title">이미지 생성 (MOCK 전용)</h2>
      <p>승인된 시나리오만 서버에서 생성 시도로 저장합니다. 이 단계의 MOCK 결과는 실제 이미지가 아니며 내보낼 수 없습니다.</p>
      {promptPreview ? <>
        <h3>실제 호출 전 프롬프트·옵션 미리보기</h3>
        <p>실행 모드: <strong>MOCK</strong> · 실제 OpenAI 호출: <strong>없음</strong> · LIVE 예정 모델 설정: {promptPreview.options.plannedLiveModel} · 크기: {promptPreview.options.size} · 품질: {promptPreview.options.quality}</p>
        <details><summary>최종 프롬프트 전문 보기</summary><pre>{promptPreview.prompt}</pre><p>SHA-256: {promptPreview.promptHash}</p></details>
        {project.status === "SCENARIO_APPROVED" && <form action={generateMockImage}><input type="hidden" name="idempotencyKey" value={randomUUID()} /><button type="submit">MOCK 이미지 생성 시도 기록</button></form>}
      </> : <p>이미지 생성은 서버에서 승인된 시나리오가 선택된 뒤에만 시작할 수 있습니다.</p>}
      {project.generationLock && <p role="status">생성 잠금이 활성화되어 있습니다. 만료: {project.generationLock.expiresAt.toLocaleString("ko-KR")}</p>}
      {project.imageAttempts.length > 0 && <><h3>생성 시도 이력</h3><ol>{project.imageAttempts.map((attempt) => <li key={attempt.id}><strong>{attempt.status}</strong> · {attempt.isMock ? "MOCK — 실제 이미지 없음" : "LIVE"} · {attempt.requestedModel} · {attempt.createdAt.toLocaleString("ko-KR")}<br />프롬프트 SHA-256: {attempt.promptHash}<br />옵션: {attempt.size} / {attempt.quality} / {attempt.outputFormat}{attempt.errorCode ? <><br />안전 오류: {attempt.errorCode} — {attempt.safeErrorMessage}</> : null}</li>)}</ol></>}
      {project.status === "SCENARIO_APPROVED" && project.imageAttempts.some((attempt) => attempt.status === "FAILED") && <form action={generateMockImage} className="form-grid" aria-label="실패한 MOCK 생성 재시도">
        <h3>실패한 생성 재시도</h3>
        <input type="hidden" name="idempotencyKey" value={randomUUID()} />
        <label>부모 생성 시도<select name="parentAttemptId" defaultValue={project.imageAttempts.find((attempt) => attempt.status === "FAILED")?.id}>{project.imageAttempts.filter((attempt) => attempt.status === "FAILED").map((attempt) => <option key={attempt.id} value={attempt.id}>{attempt.createdAt.toLocaleString("ko-KR")} · {attempt.errorCode}</option>)}</select></label>
        <label>재생성 방식<select name="regenerationMode" defaultValue="SAME_PROMPT"><option value="SAME_PROMPT">같은 프롬프트로 재생성</option><option value="MODIFIED_PROMPT">수정 지시를 추가해 재생성</option></select></label>
        <label>수정 지시 (수정 재생성일 때만 입력)<textarea name="regenerationReason" maxLength={300} placeholder="예: 2컷 말풍선 여백을 더 확보해 주세요." /></label>
        <button type="submit">실패한 MOCK 생성 재시도 기록</button>
      </form>}
    </section>
  </main>;
}
