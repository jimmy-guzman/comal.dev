"use server";

import { Effect, Exit } from "effect";
import { updateTag } from "next/cache";
import { z } from "zod";

import { appRuntime } from "@/db/service";
import { assertAgentOwnership } from "@/lib/agents";
import { assertConversationAccess, updateConversationAgent } from "@/lib/chat";
import { ForbiddenError } from "@/lib/errors";
import { authClient } from "@/lib/safe-action";

export const updateConversationAgentAction = authClient
  .inputSchema(
    z.object({
      agentId: z.string().min(1),
      conversationId: z.string().min(1),
    }),
  )
  .action(async ({ ctx, parsedInput }) => {
    const program = Effect.gen(function* () {
      yield* assertConversationAccess(ctx.auth.user.id, parsedInput.conversationId);
      yield* assertAgentOwnership(parsedInput.agentId, ctx.auth.user.id);
      yield* updateConversationAgent(parsedInput.conversationId, parsedInput.agentId);
    });

    const exit = await appRuntime.runPromiseExit(program);

    if (Exit.isFailure(exit)) {
      const { cause } = exit;

      if (cause._tag === "Fail" && cause.error._tag === "ForbiddenError") {
        throw new ForbiddenError();
      }

      throw new Error("Failed to update conversation agent.");
    }

    updateTag(`conversations:${ctx.auth.user.id}`);

    return { agentId: parsedInput.agentId };
  });
