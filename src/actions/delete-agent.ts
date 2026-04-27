"use server";

import { Effect, Exit } from "effect";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { DatabaseLive } from "@/db/service";
import { assertAgentOwnership, deleteAgent } from "@/lib/agents";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { authClient } from "@/lib/safe-action";

export const deleteAgentAction = authClient
  .inputSchema(z.object({ agentId: z.string().min(1) }))
  .action(async ({ ctx, parsedInput }) => {
    const program = Effect.gen(function* () {
      yield* assertAgentOwnership(parsedInput.agentId, ctx.auth.user.id);
      yield* deleteAgent(parsedInput.agentId);
    }).pipe(Effect.provide(DatabaseLive));

    const exit = await Effect.runPromiseExit(program);

    if (Exit.isFailure(exit)) {
      const { cause } = exit;

      if (cause._tag === "Fail") {
        if (cause.error._tag === "ForbiddenError") throw new ForbiddenError();

        if (cause.error._tag === "NotFoundError") {
          throw new NotFoundError({ resource: "agent" });
        }
      }

      throw new Error("Failed to delete agent.");
    }

    revalidatePath("/", "layout");

    return { agentId: parsedInput.agentId };
  });
