import { tool } from "ai";
import { Exit } from "effect";
import { revalidateTag } from "next/cache";
import { z } from "zod";

import type { Scorer } from "@/lib/eval-input-schema";

import { appRuntime } from "@/db/runtime";
import { AgentService } from "@/lib/agents";

import type { ToolContext } from "../types";

export const buildAgentsRevertToVersion = (_config: unknown, context: ToolContext) => {
  return tool({
    description:
      "Revert an agent's configuration to a previous version snapshot. Creates a new version reflecting the reverted state. Confirm with the user before reverting.",
    execute: async ({ agentId, versionId }) => {
      const versionExit = await appRuntime.runPromiseExit(
        AgentService.getVersion(versionId, agentId, context.userId),
      );

      if (Exit.isFailure(versionExit)) {
        return { error: "Version not found for this agent." };
      }

      const version = versionExit.value;

      if (version.subAgents.length > 0) {
        const childIds = version.subAgents.map((s) => s.childAgentId);

        const ownedExit = await appRuntime.runPromiseExit(
          AgentService.listOwnedAgentIds(context.userId, childIds),
        );

        if (Exit.isFailure(ownedExit)) {
          return { error: "Failed to validate sub-agents from the target version." };
        }

        const ownedIds = new Set(ownedExit.value.map((row) => row.id));

        for (const sub of version.subAgents) {
          if (!ownedIds.has(sub.childAgentId)) {
            return {
              error: `Sub-agent "${sub.childAgentId}" from that version no longer exists or is not owned by you.`,
            };
          }
        }
      }

      const exit = await appRuntime.runPromiseExit(
        AgentService.update(agentId, context.userId, (current) => {
          return {
            ...current,
            defaultModelId: version.modelId,
            evals: version.evals.map((e) => {
              return {
                ...e,
                expected: e.expected ?? undefined,
                scorer: e.scorer as Scorer,
                trials: e.trials ?? 1,
              };
            }),
            subAgents: version.subAgents.map((s) => {
              return {
                alias: s.alias,
                childAgentId: s.childAgentId,
                descriptionOverride: s.descriptionOverride ?? undefined,
              };
            }),
            systemPrompt: version.systemPrompt,
            tools: version.tools,
          };
        }),
      );

      if (Exit.isFailure(exit)) {
        const { cause } = exit;

        if (cause._tag === "Fail") {
          if (cause.error._tag === "AgentCycleError") {
            return {
              error: `Revert would create a sub-agent cycle: ${cause.error.cycle.join(" -> ")}.`,
            };
          }

          if (cause.error._tag === "AgentNotFoundError" || cause.error._tag === "ForbiddenError") {
            return { error: "Agent not found, not owned by you, or a system agent." };
          }
        }

        return { error: "Failed to revert agent." };
      }

      revalidateTag(`agents:${context.userId}`, "max");
      revalidateTag(`agent:${agentId}`, "max");

      return { agentId, revertedToVersionId: versionId };
    },
    inputSchema: z.object({
      agentId: z.string().min(1).describe("The ID of the agent to revert."),
      versionId: z.string().min(1).describe("The ID of the version snapshot to revert to."),
    }),
  });
};
