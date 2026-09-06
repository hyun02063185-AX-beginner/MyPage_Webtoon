import { z } from "zod";

const modeSchema = z.enum(["off", "mock", "live"]);

export type RuntimeReadiness = {
  modeLabel: "OFF" | "MOCK" | "LIVE";
  message: string;
};

export function getRuntimeReadiness(): RuntimeReadiness {
  const enabled = process.env.AI_GENERATION_ENABLED === "true";
  const parsedMode = modeSchema.safeParse(process.env.AI_GENERATION_MODE ?? "mock");
  const mode = parsedMode.success ? parsedMode.data : "mock";

  if (!enabled) return { modeLabel: "OFF", message: "비용이 발생하는 AI 생성은 서버에서 비활성화되어 있습니다." };
  if (mode === "live") return { modeLabel: "LIVE", message: "LIVE 모드는 Phase 4 이후 명시적 사용자 승인에서만 지원됩니다." };
  return { modeLabel: "MOCK", message: "목업 흐름만 허용되며 최종 내보내기는 차단됩니다." };
}
