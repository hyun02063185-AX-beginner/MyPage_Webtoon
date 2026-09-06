const liveModes = new Set(["live", "mock", "off"]);

export type ImageRuntime = {
  mode: "live" | "mock" | "off";
  model: string;
  size: string;
  quality: "low" | "medium" | "high" | "auto";
  outputCompression: number;
  apiKey: string | null;
};

function imageQuality(value: string | undefined): ImageRuntime["quality"] {
  return value === "low" || value === "medium" || value === "high" || value === "auto" ? value : "medium";
}

function imageCompression(value: string | undefined) {
  const parsed = Number(value ?? "82");
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 100 ? parsed : 82;
}

/** Server-only runtime settings. The API key is never returned to a page or action result. */
export function getImageRuntime(): ImageRuntime {
  const configuredMode = process.env.AI_GENERATION_MODE?.trim().toLowerCase() ?? "mock";
  const mode = process.env.AI_GENERATION_ENABLED === "true" && configuredMode === "live"
    ? "live"
    : liveModes.has(configuredMode) && configuredMode === "off"
      ? "off"
      : "mock";
  const apiKey = process.env.OPENAI_API_KEY?.trim() || null;

  return {
    mode,
    model: process.env.OPENAI_IMAGE_MODEL?.trim() || "gpt-image-2",
    size: process.env.OPENAI_IMAGE_SIZE?.trim() || "1536x1024",
    quality: imageQuality(process.env.OPENAI_IMAGE_QUALITY),
    outputCompression: imageCompression(process.env.WEBP_QUALITY),
    apiKey,
  };
}
