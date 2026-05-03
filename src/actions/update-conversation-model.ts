"use server";

import { Effect, Exit } from "effect";
import { updateTag } from "next/cache";
import { z } from "zod";

import { MODEL_IDS } from "@/config/models";
import { appRuntime } from "@/db/service";
import { assertConversationAccess, updateConversationModel } from "@/lib/chat";
import { ForbiddenError } from "@/lib/errors";
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
      yield* assertConversationAccess(ctx.auth.user.id, parsedInput.conversationId);
      yield* updateConversationModel(parsedInput.conversationId, parsedInput.modelId);
    });

    const exit = await appRuntime.runPromiseExit(program);

    if (Exit.isFailure(exit)) {
      const { cause } = exit;

      if (cause._tag === "Fail" && cause.error._tag === "ForbiddenError") {
        throw new ForbiddenError();
      }

      throw new Error("Failed to update conversation model.");
    }

    updateTag(`conversations:${ctx.auth.user.id}`);

    return { modelId: parsedInput.modelId };
  });
