import { tool } from "ai";
import { Exit } from "effect";
import { nanoid } from "nanoid";
import { revalidateTag } from "next/cache";
import { z } from "zod";

import { appRuntime } from "@/db/service";
import { updateAgent } from "@/lib/agents";
import { SCORER_OPTIONS, STRING_SCORERS, toolCallAssertionSchema } from "@/lib/eval-input-schema";

import type { ToolContext } from "../types";

export const buildEvalsCreate = (_config: unknown, context: ToolContext) => {
  return tool({
    description:
      "Create a new eval for an agent. For text scorers (exact, contains, levenshtein, llm-judge), provide an expected output (required for contains/exact/levenshtein). For the tool-call scorer, provide an assertion ({ mustCall?, mustNotCall?, mustCallWithArgs? }) instead of expected. Snapshots a new agent version.",
    execute: async ({ agentId, assertion, expected, input, name, scorer, trials }) => {
      if (STRING_SCORERS.includes(scorer) && !expected) {
        return { error: `Scorer "${scorer}" requires an expected output.` };
      }

      if (scorer === "tool-call" && !assertion) {
        return { error: 'Scorer "tool-call" requires an assertion.' };
      }

      if (scorer !== "tool-call" && assertion) {
        return { error: `Scorer "${scorer}" must not be passed an assertion.` };
      }

      const evalId = nanoid();

      const exit = await appRuntime.runPromiseExit(
        updateAgent(agentId, context.userId, (current) => {
          return {
            ...current,
            evals: [
              ...current.evals,
              {
                assertion,
                expected,
                id: evalId,
                input,
                name,
                scorer,
                trials: scorer === "llm-judge" || scorer === "tool-call" ? 1 : (trials ?? 1),
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
      assertion: toolCallAssertionSchema
        .optional()
        .describe(
          "The tool-call assertion. Required for the tool-call scorer; must not be set for any other scorer.",
        ),
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
        .enum(SCORER_OPTIONS)
        .describe("The scorer: exact, contains, levenshtein, llm-judge, or tool-call."),
      trials: z
        .number()
        .int()
        .min(1)
        .max(10)
        .optional()
        .describe(
          "Trial count for string scorers (1-10, default 1). llm-judge and tool-call always run once.",
        ),
    }),
  });
};
