import { afterEach, describe, expect, it, vi } from "vitest";
import { getImageRuntime } from "@/lib/config/image-runtime";

describe("image runtime", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("only enables LIVE when both the feature flag and live mode are set", () => {
    vi.stubEnv("AI_GENERATION_ENABLED", "true");
    vi.stubEnv("AI_GENERATION_MODE", "live");
    vi.stubEnv("OPENAI_API_KEY", "server-only-key");

    expect(getImageRuntime()).toMatchObject({ mode: "live", apiKey: "server-only-key", outputCompression: 82 });
  });

  it("keeps disabled generation in mock mode even when a key exists", () => {
    vi.stubEnv("AI_GENERATION_ENABLED", "false");
    vi.stubEnv("AI_GENERATION_MODE", "live");
    vi.stubEnv("OPENAI_API_KEY", "server-only-key");

    expect(getImageRuntime().mode).toBe("mock");
  });
});
