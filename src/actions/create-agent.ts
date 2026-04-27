"use server";

import { Effect, Exit } from "effect";
import { revalidatePath } from "next/cache";

import { DatabaseLive } from "@/db/service";
import { agentInputSchema } from "@/lib/agent-input-schema";
import { createAgent } from "@/lib/agents";
import { authClient } from "@/lib/safe-action";

export const createAgentAction = authClient
  .inputSchema(agentInputSchema)
  .action(async ({ ctx, parsedInput }) => {
    const program = createAgent(ctx.auth.user.id, parsedInput).pipe(Effect.provide(DatabaseLive));

    const exit = await Effect.runPromiseExit(program);

    if (Exit.isFailure(exit)) {
      throw new Error("Failed to create agent.");
    }

    revalidatePath("/", "layout");

    return exit.value;
  });
