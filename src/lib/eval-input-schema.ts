import { z } from "zod";

import { tools } from "@/agents/tools/registry";
import { SUBAGENT_PREFIX } from "@/lib/subagent-prefix";

export const OUTPUT_SCORER_OPTIONS = ["contains", "exact", "levenshtein", "llm-judge"] as const;

export const SCORER_OPTIONS = [...OUTPUT_SCORER_OPTIONS, "tool-call"] as const;

export type Scorer = (typeof SCORER_OPTIONS)[number];

export const STRING_SCORERS: readonly Scorer[] = ["contains", "exact", "levenshtein"];

export const JUDGE_MODEL_ID = "anthropic/claude-haiku-4.5";

const isKnownToolName = (toolName: string) => {
  return tools.get(toolName) !== undefined || toolName.startsWith(SUBAGENT_PREFIX);
};

export const toolCallAssertionSchema = z
  .object({
    mustCall: z.array(z.string().min(1)).optional(),
    mustCallWithArgs: z
      .array(
        z.object({
          argsMatch: z.record(z.string(), z.unknown()),
          tool: z.string().min(1),
        }),
      )
      .optional(),
    mustNotCall: z.array(z.string().min(1)).optional(),
  })
  .superRefine((value, ctx) => {
    const mustCall = value.mustCall ?? [];
    const mustNotCall = value.mustNotCall ?? [];
    const mustCallWithArgs = value.mustCallWithArgs ?? [];

    if (mustCall.length === 0 && mustNotCall.length === 0 && mustCallWithArgs.length === 0) {
      ctx.addIssue({ code: "custom", message: "Add at least one tool-call constraint." });
    }

    for (const tool of mustCall) {
      if (mustNotCall.includes(tool)) {
        ctx.addIssue({
          code: "custom",
          message: `"${tool}" is in both mustCall and mustNotCall.`,
          path: ["mustNotCall"],
        });
      }
    }

    for (const [index, tool] of mustCall.entries()) {
      if (!isKnownToolName(tool)) {
        ctx.addIssue({
          code: "custom",
          message: `Unknown tool "${tool}".`,
          path: ["mustCall", index],
        });
      }
    }

    for (const [index, tool] of mustNotCall.entries()) {
      if (!isKnownToolName(tool)) {
        ctx.addIssue({
          code: "custom",
          message: `Unknown tool "${tool}".`,
          path: ["mustNotCall", index],
        });
      }
    }

    for (const [index, entry] of mustCallWithArgs.entries()) {
      if (!isKnownToolName(entry.tool)) {
        ctx.addIssue({
          code: "custom",
          message: `Unknown tool "${entry.tool}".`,
          path: ["mustCallWithArgs", index, "tool"],
        });
      }
    }
  });

export type ToolCallAssertion = z.infer<typeof toolCallAssertionSchema>;

export const evalEntrySchema = z
  .object({
    assertion: toolCallAssertionSchema.optional(),
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

    if (value.scorer === "tool-call" && !value.assertion) {
      ctx.addIssue({
        code: "custom",
        message: "A tool-call assertion is required for this scorer.",
        path: ["assertion"],
      });
    }
  })
  .transform((value) => {
    if (value.scorer === "tool-call") {
      return { ...value, expected: undefined, trials: 1 };
    }

    return {
      ...value,
      assertion: undefined,
      trials: value.scorer === "llm-judge" ? 1 : value.trials,
    };
  });
