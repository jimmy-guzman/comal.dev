"use server";

import { Cause, Effect, Exit } from "effect";
import { returnValidationErrors } from "next-safe-action";
import { updateTag } from "next/cache";

import { appRuntime } from "@/db/runtime";
import { detectSubAgentCycle } from "@/lib/agent-graph";
import { agentInputSchema } from "@/lib/agent-input-schema";
import { AgentService } from "@/lib/agents";
import { authClient } from "@/lib/safe-action";

const PROPOSED_PARENT_ID = "__proposed__";

export const createAgentAction = authClient
  .inputSchema(agentInputSchema)
  .action(async ({ ctx, parsedInput }) => {
    if (parsedInput.subAgents.length > 0) {
      const childIds = parsedInput.subAgents.map((s) => s.childAgentId);

      const validation = await appRuntime.runPromise(
        Effect.all({
          edges: AgentService.listOwnerSubAgentEdges(ctx.auth.user.id),
          owned: AgentService.listOwnedAgentIds(ctx.auth.user.id, childIds),
        }),
      );

      const ownedIds = new Set(validation.owned.map((row) => row.id));

      for (const [index, sub] of parsedInput.subAgents.entries()) {
        if (!ownedIds.has(sub.childAgentId)) {
          returnValidationErrors(agentInputSchema, {
            subAgents: {
              [index]: { childAgentId: { _errors: ["sub-agent not found."] } },
            },
          });
        }
      }

      const cycle = detectSubAgentCycle(validation.edges, PROPOSED_PARENT_ID, childIds);

      if (cycle) {
        returnValidationErrors(agentInputSchema, {
          subAgents: {
            _errors: [`sub-agent selection would create a cycle: ${cycle.join(" -> ")}.`],
          },
        });
      }
    }

    const exit = await appRuntime.runPromiseExit(
      AgentService.create(ctx.auth.user.id, parsedInput),
    );

    if (Exit.isFailure(exit)) {
      throw new Error("Failed to create agent.", { cause: Cause.squash(exit.cause) });
    }

    updateTag(`agents:${ctx.auth.user.id}`);

    return exit.value;
  });
