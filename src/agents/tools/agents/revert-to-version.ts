import { tool } from "ai";
import { Effect, Exit } from "effect";
import { revalidateTag } from "next/cache";
import { z } from "zod";

import type { Scorer } from "@/lib/eval-input-schema";

import { appRuntime } from "@/db/service";
import { detectCycle } from "@/lib/agent-graph";
import {
  assertAgentOwnership,
  getAgentForUser,
  getAgentVersion,
  listOwnedAgentIds,
  listOwnerSubAgentEdges,
  updateAgent,
} from "@/lib/agents";

import type { ToolContext } from "../types";

export const buildAgentsRevertToVersion = (_config: unknown, context: ToolContext) => {
  return tool({
    description:
      "Revert an agent's configuration to a previous version snapshot. Creates a new version reflecting the reverted state. Confirm with the user before reverting.",
    execute: async ({ agentId, versionId }) => {
      const ownership = await appRuntime.runPromiseExit(
        assertAgentOwnership(agentId, context.userId),
      );

      if (Exit.isFailure(ownership)) {
        return { error: "Agent not found or not owned by you." };
      }

      const loadExit = await appRuntime.runPromiseExit(
        Effect.all([
          getAgentVersion(versionId, agentId, context.userId),
          getAgentForUser(agentId, context.userId),
        ]),
      );

      if (Exit.isFailure(loadExit)) {
        return { error: "Version not found for this agent." };
      }

      const [version, agentRow] = loadExit.value;

      if (agentRow.isSystem) {
        return { error: "System agents cannot be reverted." };
      }

      if (version.subAgents.length > 0) {
        const childIds = version.subAgents.map((s) => s.childAgentId);

        const validation = await appRuntime.runPromise(
          Effect.all({
            edges: listOwnerSubAgentEdges(context.userId),
            owned: listOwnedAgentIds(context.userId, childIds),
          }),
        );

        const ownedIds = new Set(validation.owned.map((row) => row.id));

        for (const sub of version.subAgents) {
          if (!ownedIds.has(sub.childAgentId)) {
            return {
              error: `Sub-agent "${sub.childAgentId}" from that version no longer exists or is not owned by you.`,
            };
          }
        }

        const edgeMap = new Map<string, string[]>();

        for (const edge of validation.edges) {
          if (edge.parentAgentId === agentId) continue;

          const list = edgeMap.get(edge.parentAgentId) ?? [];

          list.push(edge.childAgentId);
          edgeMap.set(edge.parentAgentId, list);
        }

        edgeMap.set(agentId, childIds);

        const cycle = detectCycle(edgeMap, agentId);

        if (cycle) {
          return { error: `Revert would create a sub-agent cycle: ${cycle.join(" -> ")}.` };
        }
      }

      const exit = await appRuntime.runPromiseExit(
        updateAgent(agentId, context.userId, {
          defaultModelId: version.modelId,
          description: agentRow.description ?? undefined,
          evals: version.evals.map((e) => {
            return {
              ...e,
              expected: e.expected ?? undefined,
              scorer: e.scorer as Scorer,
              trials: e.trials ?? 1,
            };
          }),
          name: agentRow.name,
          subAgents: version.subAgents.map((s) => {
            return {
              alias: s.alias,
              childAgentId: s.childAgentId,
              descriptionOverride: s.descriptionOverride ?? undefined,
            };
          }),
          systemPrompt: version.systemPrompt,
          tools: version.tools,
        }),
      );

      if (Exit.isFailure(exit)) {
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
