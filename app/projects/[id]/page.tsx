import Link from "next/link";
import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { approveScenarioVersion, archiveProject, createMockScenarioVersion, generateMockImageAttempt, requestExport, saveGalleryMetadata, saveScenarioRevision, submitImageReview, updateProject } from "@/app/actions/projects";
import { db } from "@/lib/db";
import { getMockPromptPreview } from "@/lib/image/generation";
import { panelIssueTypes } from "@/lib/review/validation";
import { scenarioSchema } from "@/lib/scenario/schema";
import { checkExportEligibility, parseStoredMetadata } from "@/lib/export/eligibility";

const workflowSteps = [
  ["DRAFT", "1. 프로젝트", "개념·대상·목적을 정합니다."],
  ["SCENARIO", "2. 4컷 시나리오", "4개 컷을 만들고 내용을 확인합니다."],
  ["IMAGE", "3. 이미지 생성", "승인된 시나리오에서만 생성 이력을 남깁니다."],
  ["REVIEW", "4. 사람 검수", "컷별 대사와 결과를 대조해 통과 또는 반려합니다."],
  ["EXPORT", "5. 완성본 미리보기·내보내기", "LIVE 이미지가 모두 통과한 뒤 WebP·JSON을 준비합니다."],
] as const;

function workflowPosition(status: string) {
  if (status === "DRAFT") return 0;
  if (status === "SCENARIO_READY" || status === "SCENARIO_APPROVED") return 1;
  if (status === "IMAGE_GENERATING") return 2;
  if (status === "IMAGE_REVIEW") return 3;
  return 4;
}

function issueLabel(issue: (typeof panelIssueTypes)[number]) {
  return ({ NORMAL: "정상", TYPO: "오타", MISSING: "누락", CROPPED: "잘림", LAYOUT: "배치 문제", OTHER: "기타" })[issue];
}

export default async function ProjectPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string; error?: string; scenario?: string; scenarioError?: string; generation?: string; generationError?: string; review?: string; reviewError?: string; compare?: string; export?: string; exportError?: string }> }) {
  const { id } = await params;
  const { saved, error, scenario: scenarioNotice, scenarioError, generation, generationError, review, reviewError, compare, export: exportNotice, exportError } = await searchParams;
  const project = await db.project.findUnique({
    where: { id },
    include: {
      selectedScenarioVersion: true,
      scenarioVersions: { orderBy: { version: "desc" } },
      imageAttempts: { orderBy: { createdAt: "desc" }, include: { imageReview: true } },
      selectedImageAttempt: { include: { imageReview: true } },
      exportBundles: { orderBy: { createdAt: "desc" } },
      generationLock: true,
    },
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
  const promptPreview = scenario && project.selectedScenarioVersion?.approvedAt ? getMockPromptPreview(project, project.selectedScenarioVersion) : null;
  const reviewAttempt = project.imageAttempts.find((attempt) => attempt.status === "READY" && !attempt.imageReview);
  const rejectedAttempt = project.imageAttempts.find((attempt) => attempt.imageReview?.result === "REJECTED");
  const compareAttempt = project.imageAttempts.find((attempt) => attempt.id === compare) ?? project.imageAttempts.find((attempt) => attempt.id !== reviewAttempt?.id);
  const currentWorkflowStep = workflowPosition(project.status);
  const metadata = parseStoredMetadata(project);
  const metadataParagraphs = metadata?.paragraphs.join("\n\n") ?? "";
  const exportEligibility = checkExportEligibility(project);
  const hasPassedMock = project.imageAttempts.some((attempt) => attempt.isMock && attempt.imageReview?.result === "PASSED");

  return <main className="shell">
    <p><Link href="/">← 프로젝트 목록</Link></p>
    <p className="eyebrow">PRIVATE WEBTOON WORKSPACE</p><h1>{project.concept}</h1>
    {saved && <p role="status">저장했습니다.</p>}{error && <p role="alert">입력값을 확인해 주세요.</p>}
    {scenarioNotice && <p role="status">시나리오 버전이 저장되었습니다.</p>}
    {scenarioError && <p role="alert">시나리오를 저장하거나 승인할 수 없습니다. 현재 상태와 입력값을 확인해 주세요.</p>}
    {generation && <p role="status">MOCK 이미지 생성 시도가 {generation === "ready" ? "준비됨" : generation === "failed" ? "실패로 기록됨" : "기존 요청으로 확인됨"} 상태로 기록되었습니다. 실제 이미지나 비용은 발생하지 않았습니다.</p>}
    {generationError && <p role="alert">이미지 생성을 시작할 수 없습니다. 승인 상태, 중복 요청 또는 재생성 사유를 확인해 주세요.</p>}
    {review === "rejected" && <p role="status">검수 반려를 기록했습니다. 반려 사유를 반영한 수정 프롬프트 재생성을 진행할 수 있습니다.</p>}
    {review === "mock-passed" && <p role="status">검수표는 통과로 저장했지만 MOCK 결과이므로 최종 내보내기는 계속 차단됩니다.</p>}
    {review === "passed" && <p role="status">사람 검수가 통과했습니다. 다음 단계에서 최종 미리보기와 내보내기를 준비할 수 있습니다.</p>}
    {reviewError && <p role="alert">검수 결과를 저장할 수 없습니다. 1~4컷 판정과 반려 사유 또는 전체 통과 확인을 점검해 주세요.</p>}
    {exportNotice === "metadata-saved" && <p role="status">갤러리 메타데이터를 저장했습니다. 실제 이미지와 검수 조건이 충족되면 내보낼 수 있습니다.</p>}
    {exportNotice === "created" && <p role="status">검증된 WebP와 갤러리 JSON 묶음을 로컬 export 폴더에 만들었습니다.</p>}
    {exportError === "metadata" && <p role="alert">slug, 제목, 이미지 설명, 해설 문단을 모두 규칙에 맞게 입력해 주세요.</p>}
    {exportError === "slug" && <p role="alert">이미 사용 중인 slug입니다. 다른 영문 소문자 slug를 입력해 주세요.</p>}
    {exportError === "mock_export_blocked" && <p role="alert">MOCK 결과는 실제 웹툰이 아니므로 내보낼 수 없습니다.</p>}
    {exportError === "review_required" && <p role="alert">사람이 통과 처리한 LIVE 이미지 시도를 먼저 선택해야 합니다.</p>}
    {exportError === "image_file_missing" && <p role="alert">내보낼 실제 WebP 파일이 아직 저장되지 않았습니다. 현재 Phase에서는 MOCK 결과만 있어 파일을 만들지 않습니다.</p>}
    {exportError === "export_validation_error" && <p role="alert">갤러리 JSON 계약을 검증하지 못했습니다. 메타데이터를 다시 저장해 주세요.</p>}

    <section className="card" aria-labelledby="workflow-title">
      <h2 id="workflow-title">이 도구로 만드는 것</h2>
      <p>AI·AX 개념을 교육용 4컷 웹툰으로 만들고, 시나리오·프롬프트·검수 이력을 함께 보존하는 비공개 제작 도구입니다.</p>
      <ol className="workflow" aria-label="웹툰 제작 단계">
        {workflowSteps.map(([key, title, description], index) => <li key={key} className={index === currentWorkflowStep ? "workflow-current" : index < currentWorkflowStep ? "workflow-done" : ""}>
          <strong>{title}</strong><span>{description}</span>{index === currentWorkflowStep && <em>현재 단계</em>}
        </li>)}
      </ol>
      <p className="note"><strong>완성된 웹툰은 5단계에서 큰 미리보기로 확인하고 WebP·JSON으로 내보냅니다.</strong> 현재 MOCK 생성본은 실제 이미지가 아니므로, 검수표를 작성해도 최종 미리보기·내보내기로 갈 수 없습니다.</p>
    </section>

    <section className="card"><h2>기본 정보</h2><form action={update} className="form-grid">
      <label>개념<input name="concept" required defaultValue={project.concept} maxLength={80} /></label>
      <label>대상 독자<input name="audience" required defaultValue={project.audience} maxLength={80} /></label>
      <label>목적<input name="purpose" required defaultValue={project.purpose} maxLength={300} /></label>
      <label>스타일<input name="style" required defaultValue={project.style} maxLength={80} /></label>
      <label>메모<textarea name="memo" defaultValue={project.memo ?? ""} maxLength={500} /></label><button type="submit">저장</button>
    </form><form action={archive}><button className="secondary" type="submit">프로젝트 보관</button></form></section>

    <section className="card" aria-labelledby="scenario-title"><h2 id="scenario-title">2단계 · 4컷 시나리오</h2>
      <p>현재 상태: <strong>{project.status}</strong> · 모든 자동 생성본은 <strong>MOCK</strong>이며 실제 OpenAI 호출은 하지 않습니다.</p>
      {!scenario && <form action={generateScenario}><button type="submit">MOCK 시나리오 만들기</button></form>}
      {scenario && <>
        <p>선택된 버전: v{project.selectedScenarioVersion!.version} · 출처: {project.selectedScenarioVersion!.sourceModel}{project.selectedScenarioVersion!.approvedAt ? " · 서버 승인 기록 있음" : ""}</p>
        {project.status === "SCENARIO_READY" ? <form action={saveScenario} className="form-grid">
          <label>용어<input name="term" required maxLength={80} defaultValue={scenario.term} /></label><label>영문명<input name="english" maxLength={160} defaultValue={scenario.english ?? ""} /></label><label>시나리오 제목<input name="title" required maxLength={160} defaultValue={scenario.title} /></label><label>대상 독자<input name="scenarioAudience" required maxLength={80} defaultValue={scenario.audience} /></label><label>핵심 메시지<textarea name="coreMessage" required maxLength={500} defaultValue={scenario.coreMessage} /></label><label>배경<textarea name="background" required maxLength={300} defaultValue={scenario.background} /></label><label>캐릭터 가이드<textarea name="characterGuide" required maxLength={300} defaultValue={scenario.characterGuide} /></label>
          {scenario.panels.map((panel) => <fieldset key={panel.number}><legend>{panel.number}컷</legend><label>장면<textarea name={`panel-${panel.number}-scene`} required maxLength={500} defaultValue={panel.scene} /></label><label>대사 (줄마다 하나)<textarea name={`panel-${panel.number}-dialogues`} required maxLength={720} defaultValue={panel.dialogues.join("\n")} /></label></fieldset>)}
          <label>최종 캡션<textarea name="finalCaption" required maxLength={240} defaultValue={scenario.finalCaption} /></label><button type="submit">수정본을 새 버전으로 저장</button>
        </form> : <ol>{scenario.panels.map((panel) => <li key={panel.number}><strong>{panel.number}컷: </strong>{panel.scene}<br />대사: {panel.dialogues.join(" / ")}</li>)}</ol>}
        {project.status === "SCENARIO_READY" && approveScenario && <form action={approveScenario}><button type="submit">이 시나리오 버전 승인</button></form>}
      </>}
      {project.scenarioVersions.length > 0 && <p>보존된 시나리오 버전: {project.scenarioVersions.map((version) => `v${version.version}${version.approvedAt ? " (승인)" : ""}`).join(", ")}</p>}
    </section>

    <section className="card" aria-labelledby="image-generation-title"><h2 id="image-generation-title">3단계 · 이미지 생성 (MOCK 전용)</h2>
      <p>승인된 시나리오만 서버에서 생성 시도로 저장합니다. 이 단계의 MOCK 결과는 실제 이미지가 아니며 내보낼 수 없습니다.</p>
      {promptPreview ? <><h3>실제 호출 전 프롬프트·옵션 미리보기</h3><p>실행 모드: <strong>MOCK</strong> · 실제 OpenAI 호출: <strong>없음</strong> · LIVE 예정 모델 설정: {promptPreview.options.plannedLiveModel} · 크기: {promptPreview.options.size} · 품질: {promptPreview.options.quality}</p><details><summary>최종 프롬프트 전문 보기</summary><pre>{promptPreview.prompt}</pre><p>SHA-256: {promptPreview.promptHash}</p></details>
        {project.status === "SCENARIO_APPROVED" && !rejectedAttempt && <form action={generateMockImage}><input type="hidden" name="idempotencyKey" value={randomUUID()} /><button type="submit">MOCK 이미지 생성 시도 기록</button></form>}
      </> : <p>이미지 생성은 서버에서 승인된 시나리오가 선택된 뒤에만 시작할 수 있습니다.</p>}
      {project.generationLock && <p role="status">생성 잠금이 활성화되어 있습니다. 만료: {project.generationLock.expiresAt.toLocaleString("ko-KR")}</p>}
      {rejectedAttempt && project.status === "SCENARIO_APPROVED" && <form action={generateMockImage} className="form-grid" aria-label="반려된 이미지 수정 재생성"><h3>반려된 이미지 수정 재생성</h3><p className="note">반려 사유를 반영한 수정 지시를 남겨야 새 시도를 만들 수 있습니다. 이전 시도는 그대로 보존됩니다.</p><input type="hidden" name="idempotencyKey" value={randomUUID()} /><input type="hidden" name="parentAttemptId" value={rejectedAttempt.id} /><input type="hidden" name="regenerationMode" value="MODIFIED_PROMPT" /><label>수정 지시<textarea name="regenerationReason" required maxLength={300} placeholder="예: 2컷 말풍선의 한글이 잘리지 않도록 여백을 확보해 주세요." /></label><button type="submit">반려 사유로 MOCK 재생성 기록</button></form>}
      {project.status === "SCENARIO_APPROVED" && project.imageAttempts.some((attempt) => attempt.status === "FAILED") && !rejectedAttempt && <form action={generateMockImage} className="form-grid" aria-label="실패한 MOCK 생성 재시도"><h3>실패한 생성 재시도</h3><input type="hidden" name="idempotencyKey" value={randomUUID()} /><label>부모 생성 시도<select name="parentAttemptId" defaultValue={project.imageAttempts.find((attempt) => attempt.status === "FAILED")?.id}>{project.imageAttempts.filter((attempt) => attempt.status === "FAILED").map((attempt) => <option key={attempt.id} value={attempt.id}>{attempt.createdAt.toLocaleString("ko-KR")} · {attempt.errorCode}</option>)}</select></label><label>재생성 방식<select name="regenerationMode" defaultValue="SAME_PROMPT"><option value="SAME_PROMPT">같은 프롬프트로 재생성</option><option value="MODIFIED_PROMPT">수정 지시를 추가해 재생성</option></select></label><label>수정 지시 (수정 재생성일 때만 입력)<textarea name="regenerationReason" maxLength={300} placeholder="예: 2컷 말풍선 여백을 더 확보해 주세요." /></label><button type="submit">실패한 MOCK 생성 재시도 기록</button></form>}
    </section>

    <section className="card" aria-labelledby="review-title"><h2 id="review-title">4단계 · 이미지 품질 검수</h2><p>사람이 예상 대사와 각 컷을 대조해 판정합니다. 자동 OCR·비전 결과로 통과 처리하지 않으며, 문제를 발견하면 사유를 남겨야 합니다.</p>
      {reviewAttempt && scenario ? <><p><strong>검수 대상:</strong> {reviewAttempt.createdAt.toLocaleString("ko-KR")} · {reviewAttempt.isMock ? "MOCK (실제 이미지 없음)" : "LIVE 이미지"}</p><div className="comic-review-grid">{scenario.panels.map((panel) => <article className="panel-preview" key={panel.number}><h3>{panel.number}컷</h3><div className="mock-canvas" aria-label={`${panel.number}컷 이미지 미리보기`}>{reviewAttempt.isMock ? "MOCK 이미지 없음" : "생성 이미지 미리보기"}</div><p><strong>예상 대사</strong><br />{panel.dialogues.join(" / ")}</p><details><summary>확대 보기</summary><div className="mock-canvas mock-canvas-large">{reviewAttempt.isMock ? "MOCK 결과에는 확대할 실제 이미지가 없습니다." : "LIVE 이미지 확대 영역"}</div></details></article>)}</div><form action={submitImageReview.bind(null, project.id, reviewAttempt.id)} className="form-grid" aria-label="컷별 이미지 검수"><h3>컷별 검수표</h3>{[1, 2, 3, 4].map((number) => <label key={number}>{number}컷 판정<select name={`panel-${number}-issue`} required defaultValue="NORMAL">{panelIssueTypes.map((issue) => <option key={issue} value={issue}>{issueLabel(issue)}</option>)}</select></label>)}<label>반려 사유 (문제가 한 컷이라도 있으면 필수)<textarea name="rejectionReason" maxLength={1000} placeholder="예: 2컷의 '응답' 글자가 잘렸습니다. 말풍선 여백을 확보해 주세요." /></label><label className="checkbox-label"><input type="checkbox" name="finalConfirmation" value="true" /> 네 컷 모두 정상이며 사람이 최종 확인했습니다.</label><button type="submit">검수 결과 저장</button></form></> : <p className="note">검수할 READY 이미지가 생기면, 이곳에서 1~4컷 판정과 반려 사유를 기록합니다.</p>}
      {project.imageAttempts.some((attempt) => attempt.imageReview) && <><h3>저장된 검수 이력</h3><ul>{project.imageAttempts.filter((attempt) => attempt.imageReview).map((attempt) => <li key={attempt.id}><strong>{attempt.imageReview!.result}</strong> · {attempt.isMock ? "MOCK — 최종 내보내기 차단" : "LIVE"} · {attempt.imageReview!.reviewedAt.toLocaleString("ko-KR")}{attempt.imageReview!.notes ? <><br />사유: {attempt.imageReview!.notes}</> : null}</li>)}</ul></>}
    </section>

    <section className="card" id="attempt-comparison" aria-labelledby="attempt-history-title"><h2 id="attempt-history-title">생성 시도 이력·비교</h2><p>새 생성과 검수 결과는 이전 기록을 덮어쓰지 않습니다. 비교할 과거 시도를 선택하면 프롬프트·옵션·검수 결과를 나란히 확인할 수 있습니다.</p>
      {project.imageAttempts.length > 0 ? <><ul>{project.imageAttempts.map((attempt) => <li key={attempt.id}><strong>{attempt.status}</strong> · {attempt.isMock ? "MOCK — 실제 이미지 없음" : "LIVE"} · {attempt.requestedModel} · {attempt.createdAt.toLocaleString("ko-KR")} · <Link href={`/projects/${project.id}?compare=${attempt.id}#attempt-comparison`}>이 시도와 비교</Link><br />프롬프트 SHA-256: {attempt.promptHash}<br />옵션: {attempt.size} / {attempt.quality} / {attempt.outputFormat}{attempt.imageReview ? <><br />검수: {attempt.imageReview.result}</> : null}{attempt.errorCode ? <><br />안전 오류: {attempt.errorCode} — {attempt.safeErrorMessage}</> : null}</li>)}</ul>
        {reviewAttempt && compareAttempt && <div className="attempt-compare"><article><h3>현재 검수 대상</h3><p>{reviewAttempt.createdAt.toLocaleString("ko-KR")}</p><p>{reviewAttempt.promptHash}</p><p>{reviewAttempt.isMock ? "MOCK — 실제 이미지 없음" : "LIVE"}</p></article><article><h3>비교 시도</h3><p>{compareAttempt.createdAt.toLocaleString("ko-KR")}</p><p>{compareAttempt.promptHash}</p><p>{compareAttempt.imageReview ? `검수 ${compareAttempt.imageReview.result}` : compareAttempt.status}</p></article></div>}
      </> : <p className="note">첫 생성 시도가 기록되면 프롬프트·옵션·검수 결과 비교가 여기에 쌓입니다.</p>}
    </section>

    <section className="card export-placeholder" id="export" aria-labelledby="export-title"><h2 id="export-title">5단계 · 갤러리 메타데이터·내보내기</h2>
      <p>여기서 MyPage 갤러리에 표시할 제목·이미지 설명·해설을 작성합니다. 실제 WebP 이미지와 사람이 통과한 검수 기록이 모두 있어야 JSON과 같은 이름의 WebP 묶음을 만듭니다.</p>
      <form action={saveGalleryMetadata.bind(null, project.id)} className="form-grid" aria-label="갤러리 메타데이터">
        <label>slug (영문 소문자·숫자·하이픈)<input name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={80} defaultValue={project.slug ?? ""} placeholder="api-request-response" /></label>
        <label>갤러리 제목<input name="title" required maxLength={160} defaultValue={project.title ?? ""} placeholder="API를 4컷으로 이해하기" /></label>
        <label>이미지 설명 (imageAlt)<textarea name="imageAlt" required maxLength={500} defaultValue={project.imageAlt ?? ""} placeholder="4컷 장면과 핵심 메시지를 설명해 주세요." /></label>
        <label>해설 문단 (빈 줄로 문단 구분)<textarea name="paragraphs" required maxLength={9000} defaultValue={metadataParagraphs} placeholder="첫 번째 해설 문단\n\n두 번째 해설 문단" /></label>
        <button type="submit">메타데이터 저장·검증</button>
      </form>
      <p><strong>내보내기 상태: </strong>{exportEligibility.ok ? "내보내기 준비 완료" : hasPassedMock ? "MOCK 검수 통과 — 최종 내보내기 차단" : "LIVE 이미지·사람 검수·WebP 파일 대기"}</p>
      {hasPassedMock && <p className="note">MOCK 결과는 실제 이미지 바이트가 아니므로 WebP나 JSON을 만들지 않습니다. 실제 LIVE 생성과 사람 검수 통과 뒤에만 결과물을 확인할 수 있습니다.</p>}
      <form action={requestExport.bind(null, project.id)}><button type="submit" disabled={!exportEligibility.ok}>WebP + JSON 묶음 내보내기</button></form>
      {project.exportBundles.length > 0 ? <><h3>내보낸 묶음 이력</h3><ul>{project.exportBundles.map((bundle) => <li key={bundle.id}>v{bundle.exportVersion} · {bundle.createdAt.toLocaleString("ko-KR")} · {bundle.imagePath} · {bundle.jsonPath}</li>)}</ul></> : <p className="note">아직 실제 내보낸 묶음이 없습니다.</p>}
    </section>
  </main>;
}
