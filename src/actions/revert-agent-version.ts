"use server";

import { Exit } from "effect";
import { updateTag } from "next/cache";
import { z } from "zod";

import type { Scorer } from "@/lib/eval-input-schema";

import { appRuntime } from "@/db/runtime";
import { AgentService } from "@/lib/agents";
import { authClient } from "@/lib/safe-action";

const inputSchema = z.object({
  agentId: z.string().min(1),
  versionId: z.string().min(1),
});

export const revertAgentVersionAction = authClient
  .inputSchema(inputSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { agentId, versionId } = parsedInput;

    const version = await appRuntime.runPromise(
      AgentService.getVersion(versionId, agentId, ctx.auth.user.id),
    );

    if (version.subAgents.length > 0) {
      const childIds = version.subAgents.map((s) => s.childAgentId);

      const owned = await appRuntime.runPromise(
        AgentService.listOwnedAgentIds(ctx.auth.user.id, childIds),
      );

      const ownedIds = new Set(owned.map((row) => row.id));

      for (const sub of version.subAgents) {
        if (!ownedIds.has(sub.childAgentId)) {
          throw new Error(`sub-agent ${sub.childAgentId} no longer exists or is not owned.`);
        }
      }
    }

    const exit = await appRuntime.runPromiseExit(
      AgentService.update(agentId, ctx.auth.user.id, (current) => {
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
          throw new Error(`revert would create a cycle: ${cause.error.cycle.join(" -> ")}.`);
        }

        if (cause.error._tag === "ForbiddenError" || cause.error._tag === "AgentNotFoundError") {
          throw cause.error;
        }
      }

      throw new Error("Failed to revert agent.");
    }

    updateTag(`agents:${ctx.auth.user.id}`);
    updateTag(`agent:${agentId}`);

    return { agentId };
  });
