"use server";

import { Cause, Exit } from "effect";
import { revalidatePath } from "next/cache";

import { appRuntime } from "@/db/service";
import { agentInputSchema } from "@/lib/agent-input-schema";
import { createAgent } from "@/lib/agents";
import { authClient } from "@/lib/safe-action";

export const createAgentAction = authClient
  .inputSchema(agentInputSchema)
  .action(async ({ ctx, parsedInput }) => {
    const exit = await appRuntime.runPromiseExit(createAgent(ctx.auth.user.id, parsedInput));

    if (Exit.isFailure(exit)) {
      throw new Error("Failed to create agent.", { cause: Cause.squash(exit.cause) });
    }

    revalidatePath("/", "layout");

    return exit.value;
  });
