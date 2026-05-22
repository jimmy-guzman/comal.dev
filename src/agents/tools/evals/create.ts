import { tool } from "ai";
import { Exit } from "effect";
import { nanoid } from "nanoid";
import { revalidateTag } from "next/cache";
import { z } from "zod";

import { appRuntime } from "@/db/service";
import { updateAgent } from "@/lib/agents";
import { OUTPUT_SCORER_OPTIONS, STRING_SCORERS } from "@/lib/eval-input-schema";

import type { ToolContext } from "../types";

export const buildEvalsCreate = (_config: unknown, context: ToolContext) => {
  return tool({
    description:
      "Create a new eval for an agent. Provide an input prompt, an expected output (required for string scorers), the scorer type, and an optional trials count. Snapshots a new agent version.",
    execute: async ({ agentId, expected, input, name, scorer, trials }) => {
      if (STRING_SCORERS.includes(scorer) && !expected) {
        return { error: `Scorer "${scorer}" requires an expected output.` };
      }

      const evalId = nanoid();

      const exit = await appRuntime.runPromiseExit(
        updateAgent(agentId, context.userId, (current) => {
          return {
            ...current,
            evals: [
              ...current.evals,
              {
                expected,
                id: evalId,
                input,
                name,
                scorer,
                trials: scorer === "llm-judge" ? 1 : (trials ?? 1),
              },
            ],
          };
        }),
      );

      if (Exit.isFailure(exit)) {
        const { cause } = exit;

        if (
          cause._tag === "Fail" &&
          (cause.error._tag === "NotFoundError" || cause.error._tag === "ForbiddenError")
        ) {
          return { error: "Agent not found, not owned by you, or a system agent." };
        }

        return { error: "Failed to create eval." };
      }

      revalidateTag(`agents:${context.userId}`, "max");
      revalidateTag(`agent:${agentId}`, "max");

      return { agentId, evalId };
    },
    inputSchema: z.object({
      agentId: z.string().min(1).describe("The ID of the agent to add the eval to."),
      expected: z
        .string()
        .min(1)
        .max(10_000)
        .optional()
        .describe(
          "The expected output. Required for the exact, contains, and levenshtein scorers.",
        ),
      input: z.string().min(1).max(10_000).describe("The user input prompt to evaluate."),
      name: z.string().min(1).max(200).describe("A short name for the eval."),
      scorer: z
        .enum(OUTPUT_SCORER_OPTIONS)
        .describe("The scorer: exact, contains, levenshtein, or llm-judge."),
      trials: z
        .number()
        .int()
        .min(1)
        .max(10)
        .optional()
        .describe("Trial count for string scorers (1-10, default 1). llm-judge always runs once."),
    }),
  });
};
