"use server";

import { Effect, Exit } from "effect";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { DatabaseLive } from "@/db/service";
import { agentInputSchema } from "@/lib/agent-input-schema";
import { assertAgentOwnership, updateAgent } from "@/lib/agents";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { authClient } from "@/lib/safe-action";

const inputSchema = agentInputSchema.extend({
  agentId: z.string().min(1),
});

export const updateAgentAction = authClient
  .inputSchema(inputSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { agentId, ...input } = parsedInput;

    const program = Effect.gen(function* () {
      yield* assertAgentOwnership(agentId, ctx.auth.user.id);
      yield* updateAgent(agentId, input);
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

      throw new Error("Failed to update agent.");
    }

    revalidatePath("/", "layout");

    return { agentId };
  });
