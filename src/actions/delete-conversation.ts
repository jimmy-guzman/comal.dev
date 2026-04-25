"use server";

import { Effect, Exit } from "effect";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { DatabaseLive } from "@/db/service";
import { assertConversationAccess, deleteConversation, getConversationAgent } from "@/lib/chat";
import { ForbiddenError } from "@/lib/errors";
import { authClient } from "@/lib/safe-action";

export const deleteConversationAction = authClient
  .inputSchema(
    z.object({
      conversationId: z.string().min(1),
    }),
  )
  .action(async ({ ctx, parsedInput }) => {
    const program = Effect.gen(function* () {
      yield* assertConversationAccess(ctx.auth.user.id, parsedInput.conversationId);

      const { agentId } = yield* getConversationAgent(parsedInput.conversationId);

      yield* deleteConversation(parsedInput.conversationId);

      return { agentId };
    }).pipe(Effect.provide(DatabaseLive));

    const exit = await Effect.runPromiseExit(program);

    if (Exit.isFailure(exit)) {
      const { cause } = exit;

      if (cause._tag === "Fail" && cause.error._tag === "ForbiddenError") {
        throw new ForbiddenError();
      }

      throw new Error("Failed to delete conversation.");
    }

    revalidatePath("/", "layout");

    return exit.value;
  });
