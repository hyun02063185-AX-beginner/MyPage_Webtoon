import { z } from "zod";

const shortText = (max: number) => z.string().trim().min(1).max(max);

export const scenarioPanelSchema = z.object({
  number: z.number().int().min(1).max(4),
  scene: shortText(500),
  dialogues: z.array(shortText(180)).min(1).max(4),
});

export const scenarioSchema = z.object({
  term: shortText(80),
  english: z.string().trim().max(160).optional(),
  title: shortText(160),
  audience: shortText(80),
  coreMessage: shortText(500),
  background: shortText(300),
  characterGuide: shortText(300),
  panels: z
    .array(scenarioPanelSchema)
    .length(4)
    .superRefine((panels, context) => {
      panels.forEach((panel, index) => {
        if (panel.number !== index + 1) {
          context.addIssue({
            code: "custom",
            message: "패널 번호는 1부터 4까지 순서대로 지정해야 합니다.",
            path: [index, "number"],
          });
        }
      });
    }),
  finalCaption: shortText(240),
});

export type Scenario = z.infer<typeof scenarioSchema>;
