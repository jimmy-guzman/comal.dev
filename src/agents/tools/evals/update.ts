import { tool } from "ai";
import { Exit } from "effect";
import { revalidateTag } from "next/cache";
import { z } from "zod";

import type { Scorer } from "@/lib/eval-input-schema";

import { appRuntime } from "@/db/service";
import { getAgentForUser, updateAgent } from "@/lib/agents";
import { evalEntrySchema, SCORER_OPTIONS } from "@/lib/eval-input-schema";
import { getEvalWithOwnership } from "@/lib/evals";

import type { ToolContext } from "../types";

export const buildEvalsUpdate = (_config: unknown, context: ToolContext) => {
  return tool({
    description:
      "Update one or more fields on an existing eval. Only the provided fields change. Snapshots a new agent version.",
    execute: async ({ evalId, expected, input, name, scorer, trials }) => {
      if (
        expected === undefined &&
        input === undefined &&
        name === undefined &&
        scorer === undefined &&
        trials === undefined
      ) {
        return { error: "Provide at least one field to update." };
      }

      const existingExit = await appRuntime.runPromiseExit(
        getEvalWithOwnership(evalId, context.userId),
      );

      if (Exit.isFailure(existingExit)) {
        return { error: "Eval not found or not owned by you." };
      }

      const existing = existingExit.value;
      const { agentId } = existing;

      const current = await appRuntime.runPromise(getAgentForUser(agentId, context.userId));

      if (current.isSystem) return { error: "System agents cannot be edited." };

      if (!current.evals.some((e) => e.id === evalId)) {
        return { error: "Eval not found or not owned by you." };
      }

      const parsed = evalEntrySchema.safeParse({
        expected: expected ?? existing.expected ?? undefined,
        id: evalId,
        input: input ?? existing.input,
        name: name ?? existing.name,
        scorer: scorer ?? (existing.scorer as Scorer),
        trials: trials ?? existing.trials,
      });

      if (!parsed.success) {
        return { error: parsed.error.issues[0]?.message ?? "Invalid eval after update." };
      }

      const nextEvals = current.evals.map((e) => {
        if (e.id === evalId) return parsed.data;

        return { ...e, expected: e.expected ?? undefined, scorer: e.scorer as Scorer };
      });

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

      if (Exit.isFailure(exit)) return { error: "Failed to update eval." };

      revalidateTag(`agents:${context.userId}`, "max");
      revalidateTag(`agent:${agentId}`, "max");

      return { agentId, evalId };
    },
    inputSchema: z.object({
      evalId: z.string().min(1).describe("The ID of the eval to update."),
      expected: z.string().min(1).max(10_000).optional().describe("New expected output."),
      input: z.string().min(1).max(10_000).optional().describe("New input prompt."),
      name: z.string().min(1).max(200).optional().describe("New eval name."),
      scorer: z.enum(SCORER_OPTIONS).optional().describe("New scorer type."),
      trials: z.number().int().min(1).max(10).optional().describe("New trial count (1-10)."),
    }),
  });
};
