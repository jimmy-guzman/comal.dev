"use server";

import { Exit } from "effect";
import { updateTag } from "next/cache";
import { z } from "zod";

import { MODEL_IDS } from "@/config/models";
import { appRuntime } from "@/db/service";
import { updateAgent } from "@/lib/agents";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { authClient } from "@/lib/safe-action";

const inputSchema = z.object({
  agentId: z.string().min(1),
  defaultModelId: z.enum(MODEL_IDS),
  description: z.string().trim().max(500).optional(),
  name: z.string().trim().min(1).max(100),
});

export const updateAgentBasicsAction = authClient
  .inputSchema(inputSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { agentId, defaultModelId, description, name } = parsedInput;

    const exit = await appRuntime.runPromiseExit(
      updateAgent(agentId, ctx.auth.user.id, (current) => {
        return { ...current, defaultModelId, description, name };
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
