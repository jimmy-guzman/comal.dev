"use server";

import { Effect, Exit } from "effect";
import { updateTag } from "next/cache";
import { z } from "zod";

import { appRuntime } from "@/db/service";
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
    });

    const exit = await appRuntime.runPromiseExit(program);

    if (Exit.isFailure(exit)) {
      const { cause } = exit;

      if (cause._tag === "Fail" && cause.error._tag === "ForbiddenError") {
        throw new ForbiddenError();
      }

      throw new Error("Failed to delete conversation.");
    }

    updateTag(`conversations:${ctx.auth.user.id}`);

    return exit.value;
  });
