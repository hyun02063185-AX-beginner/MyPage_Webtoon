import { getRuntimeReadiness } from "@/lib/config/runtime";

export default function HomePage() {
  const readiness = getRuntimeReadiness();

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
    </main>
  );
}
