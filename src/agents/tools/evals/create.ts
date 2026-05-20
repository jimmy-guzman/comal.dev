import { tool } from "ai";
import { Exit } from "effect";
import { nanoid } from "nanoid";
import { revalidateTag } from "next/cache";
import { z } from "zod";

import type { Scorer } from "@/lib/eval-input-schema";

import { appRuntime } from "@/db/service";
import { assertAgentOwnership, getAgentForUser, updateAgent } from "@/lib/agents";
import { SCORER_OPTIONS, STRING_SCORERS } from "@/lib/eval-input-schema";

import type { ToolContext } from "../types";

export const buildEvalsCreate = (_config: unknown, context: ToolContext) => {
  return tool({
    description:
      "Create a new eval for an agent. Provide an input prompt, an expected output (required for string scorers), the scorer type, and an optional trials count. Snapshots a new agent version.",
    execute: async ({ agentId, expected, input, name, scorer, trials }) => {
      const ownership = await appRuntime.runPromiseExit(
        assertAgentOwnership(agentId, context.userId),
      );

      if (Exit.isFailure(ownership)) {
        return { error: "Agent not found or not owned by you." };
      }

      if (STRING_SCORERS.includes(scorer) && !expected) {
        return { error: `Scorer "${scorer}" requires an expected output.` };
      }

      const current = await appRuntime.runPromise(getAgentForUser(agentId, context.userId));

      if (current.isSystem) return { error: "System agents cannot be edited." };

      const evalId = nanoid();

      const nextEvals = [
        ...current.evals.map((e) => {
          return { ...e, expected: e.expected ?? undefined, scorer: e.scorer as Scorer };
        }),
        {
          expected,
          id: evalId,
          input,
          name,
          scorer,
          trials: scorer === "llm-judge" ? 1 : (trials ?? 1),
        },
      ];

      const exit = await appRuntime.runPromiseExit(
        updateAgent(agentId, context.userId, {
          defaultModelId: current.defaultModelId,
          description: current.description ?? undefined,
          evals: nextEvals,
          name: current.name,
          subAgents: current.subAgents.map((s) => {
            return {
              alias: s.alias,
              childAgentId: s.childAgentId,
              descriptionOverride: s.descriptionOverride ?? undefined,
            };
          }),
          systemPrompt: current.systemPrompt,
          tools: current.tools,
        }),
      );

      if (Exit.isFailure(exit)) return { error: "Failed to create eval." };

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
        .enum(SCORER_OPTIONS)
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
