import { afterEach, describe, expect, it, vi } from "vitest";

describe("getRuntimeReadiness", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("defaults to OFF without an explicit enabled flag", async () => {
    vi.stubEnv("AI_GENERATION_ENABLED", "false");
    const { getRuntimeReadiness } = await import("@/lib/config/runtime");
    expect(getRuntimeReadiness().modeLabel).toBe("OFF");
  });

  it("requires explicit enablement before reporting LIVE", async () => {
    vi.stubEnv("AI_GENERATION_ENABLED", "true");
    vi.stubEnv("AI_GENERATION_MODE", "live");
    const { getRuntimeReadiness } = await import("@/lib/config/runtime");
    expect(getRuntimeReadiness().modeLabel).toBe("LIVE");
  });
});
