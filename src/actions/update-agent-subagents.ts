"use server";

import { Effect, Exit } from "effect";
import { returnValidationErrors } from "next-safe-action";
import { updateTag } from "next/cache";
import { z } from "zod";

import { appRuntime } from "@/db/service";
import { detectCycle } from "@/lib/agent-graph";
import { agentInputSchema } from "@/lib/agent-input-schema";
import { listOwnedAgentIds, listOwnerSubAgentEdges, updateAgent } from "@/lib/agents";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { authClient } from "@/lib/safe-action";

const inputSchema = z.object({
  agentId: z.string().min(1),
  subAgents: agentInputSchema.shape.subAgents,
});

export const updateAgentSubagentsAction = authClient
  .inputSchema(inputSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { agentId, subAgents } = parsedInput;

    if (subAgents.length > 0) {
      const childIds = subAgents.map((s) => s.childAgentId);

      for (const [index, sub] of subAgents.entries()) {
        if (sub.childAgentId === agentId) {
          returnValidationErrors(inputSchema, {
            subAgents: {
              [index]: { childAgentId: { _errors: ["an agent cannot be its own sub-agent."] } },
            },
          });
        }
      }

      const validation = await appRuntime.runPromise(
        Effect.all({
          edges: listOwnerSubAgentEdges(ctx.auth.user.id),
          owned: listOwnedAgentIds(ctx.auth.user.id, childIds),
        }),
      );

      const ownedIds = new Set(validation.owned.map((row) => row.id));

      for (const [index, sub] of subAgents.entries()) {
        if (!ownedIds.has(sub.childAgentId)) {
          returnValidationErrors(inputSchema, {
            subAgents: {
              [index]: { childAgentId: { _errors: ["sub-agent not found."] } },
            },
          });
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
        returnValidationErrors(inputSchema, {
          subAgents: {
            _errors: [`sub-agent selection would create a cycle: ${cycle.join(" -> ")}.`],
          },
        });
      }
    }

    const exit = await appRuntime.runPromiseExit(
      updateAgent(agentId, ctx.auth.user.id, (current) => {
        return { ...current, subAgents };
      }),
    );

    if (Exit.isFailure(exit)) {
      const { cause } = exit;

      if (cause._tag === "Fail") {
        if (cause.error._tag === "ForbiddenError") throw new ForbiddenError();

        if (cause.error._tag === "NotFoundError") throw new NotFoundError({ resource: "agent" });
      }

      throw new Error("Failed to update agent.");
    }

    updateTag(`agents:${ctx.auth.user.id}`);
    updateTag(`agent:${agentId}`);

    return { agentId };
  });
