"use server";

import { Effect, Exit } from "effect";
import { updateTag } from "next/cache";
import { z } from "zod";

import { MODEL_IDS } from "@/config/models";
import { appRuntime } from "@/db/runtime";
import { ChatService } from "@/lib/chat";
import { authClient } from "@/lib/safe-action";

export const updateConversationModelAction = authClient
  .inputSchema(
    z.object({
      conversationId: z.string().min(1),
      modelId: z.enum(MODEL_IDS),
    }),
  )
  .action(async ({ ctx, parsedInput }) => {
    const program = Effect.gen(function* () {
      yield* ChatService.assertAccess(ctx.auth.user.id, parsedInput.conversationId);
      yield* ChatService.updateModel(parsedInput.conversationId, parsedInput.modelId);
    });

    const exit = await appRuntime.runPromiseExit(program);

    if (Exit.isFailure(exit)) {
      const { cause } = exit;

      if (
        cause._tag === "Fail" &&
        (cause.error._tag === "ForbiddenError" || cause.error._tag === "ConversationNotFoundError")
      ) {
        throw cause.error;
      }

      throw new Error("Failed to update conversation model.");
    }

    updateTag(`conversations:${ctx.auth.user.id}`);

    return { modelId: parsedInput.modelId };
  });
