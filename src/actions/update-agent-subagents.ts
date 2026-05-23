"use server";

import { Exit } from "effect";
import { returnValidationErrors } from "next-safe-action";
import { updateTag } from "next/cache";
import { z } from "zod";

import { appRuntime } from "@/db/runtime";
import { agentInputSchema } from "@/lib/agent-input-schema";
import { AgentService } from "@/lib/agents";
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

      const owned = await appRuntime.runPromise(
        AgentService.listOwnedAgentIds(ctx.auth.user.id, childIds),
      );

      const ownedIds = new Set(owned.map((row) => row.id));

      for (const [index, sub] of subAgents.entries()) {
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
      AgentService.update(agentId, ctx.auth.user.id, (current) => {
        return { ...current, subAgents };
      }),
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
