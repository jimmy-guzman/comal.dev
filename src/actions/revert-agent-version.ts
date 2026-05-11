"use server";

import { Effect, Exit } from "effect";
import { updateTag } from "next/cache";
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
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { authClient } from "@/lib/safe-action";

const inputSchema = z.object({
  agentId: z.string().min(1),
  versionId: z.string().min(1),
});

export const revertAgentVersionAction = authClient
  .inputSchema(inputSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { agentId, versionId } = parsedInput;

    const ownership = await appRuntime.runPromiseExit(
      assertAgentOwnership(agentId, ctx.auth.user.id),
    );

    if (Exit.isFailure(ownership)) {
      const { cause } = ownership;

      if (cause._tag === "Fail") {
        if (cause.error._tag === "ForbiddenError") throw new ForbiddenError();

        if (cause.error._tag === "NotFoundError") {
          throw new NotFoundError({ resource: "agent" });
        }
      }

      throw new Error("Failed to revert agent.");
    }

    const [version, agentRow] = await appRuntime.runPromise(
      Effect.all([getAgentVersion(versionId, agentId), getAgentForUser(agentId, ctx.auth.user.id)]),
    );

    if (agentRow.isSystem) {
      throw new ForbiddenError();
    }

    if (version.subAgents.length > 0) {
      const childIds = version.subAgents.map((s) => s.childAgentId);

      const validation = await appRuntime.runPromise(
        Effect.all({
          edges: listOwnerSubAgentEdges(ctx.auth.user.id),
          owned: listOwnedAgentIds(ctx.auth.user.id, childIds),
        }),
      );

      const ownedIds = new Set(validation.owned.map((row) => row.id));

      for (const sub of version.subAgents) {
        if (!ownedIds.has(sub.childAgentId)) {
          throw new Error(`sub-agent ${sub.childAgentId} no longer exists or is not owned.`);
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
        throw new Error(`revert would create a cycle: ${cycle.join(" -> ")}.`);
      }
    }

    const exit = await appRuntime.runPromiseExit(
      updateAgent(agentId, ctx.auth.user.id, {
        defaultModelId: version.modelId,
        description: agentRow.description ?? undefined,
        evals: agentRow.evals.map((e) => ({ ...e, scorer: e.scorer as Scorer })),
        name: agentRow.name,
        subAgents: version.subAgents.map((s) => {
          return {alias: s.alias, childAgentId: s.childAgentId, descriptionOverride: s.descriptionOverride ?? undefined};
        }),
        systemPrompt: version.systemPrompt,
        tools: version.tools,
      }),
    );

    if (Exit.isFailure(exit)) {
      throw new Error("Failed to revert agent.");
    }

    updateTag(`agents:${ctx.auth.user.id}`);
    updateTag(`agent:${agentId}`);

    return { agentId };
  });
