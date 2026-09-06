/* eslint-disable @next/next/no-img-element -- previews stay behind the local read-only route and must not be optimized or copied. */
import Link from "next/link";
import { buildLegacySelectionManifest, scanLegacyAssets } from "@/lib/legacy/scanner";

function selectedAssetRefs(value: string | string[] | undefined) {
  return Array.isArray(value) ? value : value ? [value] : [];
}

function formatBytes(value: number) {
  return `${(value / 1024 / 1024).toFixed(2)} MB`;
}

export default async function LegacyAssetsPage({ searchParams }: { searchParams: Promise<{ asset?: string | string[] }> }) {
  const { asset: selectedParam } = await searchParams;
  const selectedRefs = selectedAssetRefs(selectedParam);
  const manifest = await scanLegacyAssets();
  const selection = buildLegacySelectionManifest(manifest.assets, selectedRefs);
  const selected = new Set(selection.map((asset) => asset.assetRef));

  return <main className="shell">
    <p><Link href="/">← 프로젝트 목록</Link></p>
    <p className="eyebrow">READ-ONLY LEGACY REVIEW</p>
    <h1>과거 웹툰 후보 검토</h1>
    <p className="intro">`backup_images/` 원본을 읽기 전용으로 점검합니다. 이 화면은 새 프로젝트·갤러리 내보내기와 분리되어 있으며, 파일을 복사하거나 이름을 바꾸거나 DB에 등록하지 않습니다.</p>

    <section className="card" aria-labelledby="legacy-rules-title">
      <h2 id="legacy-rules-title">이관 전 확인 규칙</h2>
      <ul>
        <li>출처: <strong>LEGACY</strong> · 프롬프트: <strong>없음 (promptUnavailable=true)</strong></li>
        <li>후보 식별자: <code>LEGACY:SHA-256</code> — 파일명은 화면 표시용이며 경로 입력으로 사용하지 않습니다.</li>
        <li>선택해도 아직 이관하지 않습니다. 선택 목록은 아래에서 <strong>이관 준비 계획</strong>으로만 확인합니다.</li>
      </ul>
    </section>

    <section className="card" aria-labelledby="legacy-summary-title">
      <h2 id="legacy-summary-title">스캔 결과</h2>
      <p>이미지 후보 {manifest.assets.length}개 · 제외된 비이미지 파일 {manifest.skippedFiles.length}개</p>
      <p className="note">해상도가 여러 종류면 신규 WebP export 규격과 혼동하지 않도록 별도로 표시합니다. 이 단계에서는 변환하지 않습니다.</p>
      <ul className="dimension-summary">{manifest.dimensionGroups.map((group) => <li key={group.label}>{group.label}: {group.count}개</li>)}</ul>
    </section>

    {manifest.assets.length === 0 ? <section className="card"><h2>후보가 없습니다</h2><p>읽기 전용 `backup_images/` 폴더에 PNG, JPEG, WebP 또는 GIF 파일을 추가하면 후보로 표시됩니다. 자동 이관은 하지 않습니다.</p></section> : <form method="get" className="legacy-selection-form">
      <section className="card" aria-labelledby="legacy-candidates-title">
        <h2 id="legacy-candidates-title">이관 후보</h2>
        <p className="note">각 후보를 열어 원본을 직접 확인한 뒤, 나중에 별도 이관 대상으로 검토할 항목만 선택하세요.</p>
        <div className="legacy-grid">
          {manifest.assets.map((asset) => <article className="legacy-asset" key={asset.assetRef}>
            {asset.format === "unknown" ? <div className="legacy-unavailable">미리보기 불가</div> : <img alt={`${asset.fileName} 원본 미리보기`} className="legacy-preview" src={`/api/legacy-assets/${encodeURIComponent(asset.assetRef)}`} />}
            <label className="checkbox-label"><input type="checkbox" name="asset" value={asset.assetRef} defaultChecked={selected.has(asset.assetRef)} /> 이 후보를 이관 준비 목록에 포함</label>
            <p><strong>{asset.fileName}</strong></p>
            <dl><dt>해상도</dt><dd>{asset.width && asset.height ? `${asset.width} × ${asset.height}` : "식별 불가"}</dd><dt>형식 · 크기</dt><dd>{asset.format.toUpperCase()} · {formatBytes(asset.sizeBytes)}</dd><dt>출처</dt><dd>{asset.source} · 프롬프트 없음</dd><dt>SHA-256</dt><dd><code>{asset.sha256}</code></dd></dl>
          </article>)}
        </div>
        <button type="submit">선택한 후보로 이관 준비 계획 보기</button>
      </section>
    </form>}

    <section className="card" aria-labelledby="legacy-selection-title">
      <h2 id="legacy-selection-title">이관 준비 계획</h2>
      {selection.length === 0 ? <p>선택된 후보가 없습니다. 따라서 파일·DB·프로젝트에 변경된 내용도 없습니다.</p> : <><p><strong>{selection.length}개</strong> 후보를 명시적으로 선택했습니다. 아직 실제 이관은 실행하지 않았습니다.</p><ul>{selection.map((asset) => <li key={asset.assetRef}><strong>{asset.fileName}</strong><br /><code>{asset.assetRef}</code><br />{asset.source} · promptUnavailable=true · 상태: {asset.importAction}</li>)}</ul><p className="note">실제 이관은 파일 복사·명시적 메타데이터 입력·충돌 보고·해시 재검증이 포함된 별도 승인 작업으로만 수행합니다.</p></>}
    </section>
  </main>;
}
