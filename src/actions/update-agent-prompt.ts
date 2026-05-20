"use server";

import { Exit } from "effect";
import { updateTag } from "next/cache";
import { z } from "zod";

import { appRuntime } from "@/db/service";
import { updateAgent } from "@/lib/agents";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
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
      updateAgent(agentId, ctx.auth.user.id, (current) => {
        return { ...current, systemPrompt };
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
