"use server";

import { Exit } from "effect";
import { returnValidationErrors } from "next-safe-action";
import { updateTag } from "next/cache";
import { z } from "zod";

import { appRuntime } from "@/db/runtime";
import { agentInputSchema } from "@/lib/agent-input-schema";
import { AgentService } from "@/lib/agents";
import { authClient } from "@/lib/safe-action";

const inputSchema = agentInputSchema.extend({
  agentId: z.string().min(1),
});

export const updateAgentAction = authClient
  .inputSchema(inputSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { agentId, ...input } = parsedInput;

    if (input.subAgents.length > 0) {
      const childIds = input.subAgents.map((s) => s.childAgentId);

      for (const [index, sub] of input.subAgents.entries()) {
        if (sub.childAgentId === agentId) {
          returnValidationErrors(inputSchema, {
            subAgents: {
              [index]: {
                childAgentId: { _errors: ["an agent cannot be its own sub-agent."] },
              },
            },
          });
        }
      }

      const owned = await appRuntime.runPromise(
        AgentService.listOwnedAgentIds(ctx.auth.user.id, childIds),
      );

      const ownedIds = new Set(owned.map((row) => row.id));

      for (const [index, sub] of input.subAgents.entries()) {
        if (!ownedIds.has(sub.childAgentId)) {
          returnValidationErrors(inputSchema, {
            subAgents: {
              [index]: { childAgentId: { _errors: ["sub-agent not found."] } },
            },
          });
        }
      }
    }

    const exit = await appRuntime.runPromiseExit(
      AgentService.update(agentId, ctx.auth.user.id, () => input),
    );

    if (Exit.isFailure(exit)) {
      const { cause } = exit;

      if (cause._tag === "Fail") {
        if (cause.error._tag === "AgentCycleError") {
          returnValidationErrors(inputSchema, {
            subAgents: {
              _errors: [
                `sub-agent selection would create a cycle: ${cause.error.cycle.join(" -> ")}.`,
              ],
            },
          });
        }

        if (cause.error._tag === "ForbiddenError" || cause.error._tag === "AgentNotFoundError") {
          throw cause.error;
        }
      }

      throw new Error("Failed to update agent.");
    }

    updateTag(`agents:${ctx.auth.user.id}`);
    updateTag(`agent:${agentId}`);

    return { agentId };
  });
