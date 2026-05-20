import { tool } from "ai";
import { Exit } from "effect";
import { revalidateTag } from "next/cache";
import { z } from "zod";

import type { Scorer } from "@/lib/eval-input-schema";

import { appRuntime } from "@/db/service";
import { getAgentForUser, updateAgent } from "@/lib/agents";
import { getEvalWithOwnership } from "@/lib/evals";

import type { ToolContext } from "../types";

export const buildEvalsDelete = (_config: unknown, context: ToolContext) => {
  return tool({
    description:
      "Delete an eval from an agent. Snapshots a new agent version reflecting the removal.",
    execute: async ({ evalId }) => {
      const existingExit = await appRuntime.runPromiseExit(
        getEvalWithOwnership(evalId, context.userId),
      );

      if (Exit.isFailure(existingExit)) {
        return { error: "Eval not found or not owned by you." };
      }

      const { agentId } = existingExit.value;

      const current = await appRuntime.runPromise(getAgentForUser(agentId, context.userId));

      if (current.isSystem) return { error: "System agents cannot be edited." };

      const nextEvals = current.evals
        .filter((e) => e.id !== evalId)
        .map((e) => {
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

      if (Exit.isFailure(exit)) return { error: "Failed to delete eval." };

      revalidateTag(`agents:${context.userId}`, "max");
      revalidateTag(`agent:${agentId}`, "max");

      return { agentId, evalId };
    },
    inputSchema: z.object({
      evalId: z.string().min(1).describe("The ID of the eval to delete."),
    }),
  });
};
