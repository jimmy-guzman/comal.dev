"use server";

import { revalidatePath } from "next/cache";
import { Effect, Exit } from "effect";
import { z } from "zod";

import { DatabaseLive } from "@/db/service";
import { assertConversationAccess, updateConversationModel } from "@/lib/chat";
import { ForbiddenError } from "@/lib/errors";
import { authClient } from "@/lib/safe-action";

export const updateConversationModelAction = authClient
  .inputSchema(
    z.object({
      conversationId: z.string().min(1),
      modelId: z.string().min(1),
    }),
  )
  .action(async ({ parsedInput, ctx }) => {
    const program = Effect.gen(function* () {
      yield* assertConversationAccess(ctx.auth.user.id, parsedInput.conversationId);
      yield* updateConversationModel(parsedInput.conversationId, parsedInput.modelId);
    }).pipe(Effect.provide(DatabaseLive));

    const exit = await Effect.runPromiseExit(program);

    if (Exit.isFailure(exit)) {
      const cause = exit.cause;
      if (cause._tag === "Fail" && cause.error._tag === "ForbiddenError") {
        throw new ForbiddenError();
      }
      throw new Error("Failed to update conversation model.");
    }

    revalidatePath("/", "layout");

    return { modelId: parsedInput.modelId };
  });
