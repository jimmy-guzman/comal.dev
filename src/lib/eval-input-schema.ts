import { z } from "zod";

export const SCORER_OPTIONS = ["contains", "exact", "levenshtein", "llm-judge"] as const;

export type Scorer = (typeof SCORER_OPTIONS)[number];

export const STRING_SCORERS: readonly Scorer[] = ["contains", "exact", "levenshtein"];

export const JUDGE_MODEL_ID = "anthropic/claude-haiku-4.5";

export const evalEntrySchema = z
  .object({
    expected: z.string().trim().min(1).max(10_000).optional(),
    id: z.string().min(1).optional(),
    input: z.string().trim().min(1).max(10_000),
    name: z.string().trim().min(1).max(200),
    scorer: z.enum(SCORER_OPTIONS),
    trials: z.number().int().min(1).max(10).default(1),
  })
  .superRefine((value, ctx) => {
    if (STRING_SCORERS.includes(value.scorer) && !value.expected) {
      ctx.addIssue({
        code: "custom",
        message: "Expected output is required for this scorer.",
        path: ["expected"],
      });
    }
  });
