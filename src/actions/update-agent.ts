"use server";

import { Effect, Exit } from "effect";
import { returnValidationErrors } from "next-safe-action";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { appRuntime } from "@/db/service";
import { detectCycle } from "@/lib/agent-graph";
import { agentInputSchema } from "@/lib/agent-input-schema";
import {
  assertAgentOwnership,
  listOwnedAgentIds,
  listOwnerSubAgentEdges,
  updateAgent,
} from "@/lib/agents";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { authClient } from "@/lib/safe-action";

const inputSchema = agentInputSchema.extend({
  agentId: z.string().min(1),
});

export const updateAgentAction = authClient
  .inputSchema(inputSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { agentId, ...input } = parsedInput;

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

      throw new Error("Failed to update agent.");
    }

    if (input.subAgents.length > 0) {
      const childIds = input.subAgents.map((s) => s.childAgentId);

      for (const [index, sub] of input.subAgents.entries()) {
        if (sub.childAgentId === agentId) {
          returnValidationErrors(inputSchema, {
            subAgents: {
              [index]: {
                childAgentId: { _errors: ["An agent cannot be its own sub-agent."] },
              },
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

      for (const [index, sub] of input.subAgents.entries()) {
        if (!ownedIds.has(sub.childAgentId)) {
          returnValidationErrors(inputSchema, {
            subAgents: {
              [index]: { childAgentId: { _errors: ["Sub-agent not found."] } },
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
            _errors: [`Sub-agent selection would create a cycle: ${cycle.join(" -> ")}.`],
          },
        });
      }
    }

    const exit = await appRuntime.runPromiseExit(updateAgent(agentId, input));

    if (Exit.isFailure(exit)) {
      throw new Error("Failed to update agent.");
    }

    revalidatePath("/", "layout");

    return { agentId };
  });
