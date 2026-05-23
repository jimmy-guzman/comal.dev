"use server";

import { Exit } from "effect";
import { updateTag } from "next/cache";
import { z } from "zod";

import { appRuntime } from "@/db/runtime";
import { AgentService } from "@/lib/agents";
import { authClient } from "@/lib/safe-action";

const inputSchema = z.object({
  agentId: z.string().min(1),
  systemPrompt: z.string().trim().min(1).max(20_000),
});

export const updateAgentPromptAction = authClient
  .inputSchema(inputSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { agentId, systemPrompt } = parsedInput;

    const exit = await appRuntime.runPromiseExit(
      AgentService.update(agentId, ctx.auth.user.id, (current) => {
        return { ...current, systemPrompt };
      }),
    );

    if (Exit.isFailure(exit)) {
      const { cause } = exit;

      if (
        cause._tag === "Fail" &&
        (cause.error._tag === "ForbiddenError" || cause.error._tag === "AgentNotFoundError")
      ) {
        throw cause.error;
      }

      throw new Error("Failed to update agent.");
    }

    updateTag(`agents:${ctx.auth.user.id}`);
    updateTag(`agent:${agentId}`);

    return { agentId };
  });
