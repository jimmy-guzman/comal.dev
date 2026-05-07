import { z } from "zod";

export const SCORER_OPTIONS = ["contains", "exact"] as const;

export type Scorer = (typeof SCORER_OPTIONS)[number];

export const evalEntrySchema = z.object({
  expected: z.string().trim().min(1).max(10_000),
  id: z.string().optional(),
  input: z.string().trim().min(1).max(10_000),
  name: z.string().trim().min(1).max(200),
  scorer: z.enum(SCORER_OPTIONS),
});
