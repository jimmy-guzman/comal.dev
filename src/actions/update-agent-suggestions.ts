"use server";

import { Exit } from "effect";
import { updateTag } from "next/cache";
import { z } from "zod";

import { appRuntime } from "@/db/runtime";
import { AgentService } from "@/lib/agents";
import { authClient } from "@/lib/safe-action";

const inputSchema = z.object({
  agentId: z.string().min(1),
  suggestions: z.array(z.string().trim().min(1).max(100)).max(8),
});

export const updateAgentSuggestionsAction = authClient
  .inputSchema(inputSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { agentId, suggestions } = parsedInput;

    const exit = await appRuntime.runPromiseExit(
      AgentService.updateSuggestions(agentId, ctx.auth.user.id, suggestions),
    );

    if (Exit.isFailure(exit)) {
      const { cause } = exit;

      if (
        cause._tag === "Fail" &&
        (cause.error._tag === "ForbiddenError" || cause.error._tag === "AgentNotFoundError")
      ) {
        throw cause.error;
      }

      throw new Error("Failed to update suggestions.");
    }

    updateTag(`agents:${ctx.auth.user.id}`);
    updateTag(`agent:${agentId}`);

    return { agentId };
  });
