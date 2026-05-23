"use server";

import { Effect, Exit } from "effect";
import { updateTag } from "next/cache";
import { z } from "zod";

import { appRuntime } from "@/db/runtime";
import { ChatService } from "@/lib/chat";
import { authClient } from "@/lib/safe-action";

export const deleteConversationAction = authClient
  .inputSchema(
    z.object({
      conversationId: z.string().min(1),
    }),
  )
  .action(async ({ ctx, parsedInput }) => {
    const program = Effect.gen(function* () {
      yield* ChatService.assertAccess(ctx.auth.user.id, parsedInput.conversationId);

      const { agentId } = yield* ChatService.getAgent(parsedInput.conversationId);

      yield* ChatService.delete(parsedInput.conversationId);

      return { agentId };
    });

    const exit = await appRuntime.runPromiseExit(program);

    if (Exit.isFailure(exit)) {
      const { cause } = exit;

      if (cause._tag === "Fail" && cause.error._tag === "ForbiddenError") {
        throw cause.error;
      }

      throw new Error("Failed to delete conversation.");
    }

    updateTag(`conversations:${ctx.auth.user.id}`);

    return exit.value;
  });
