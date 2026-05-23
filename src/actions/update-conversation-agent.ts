"use server";

import { Effect, Exit } from "effect";
import { updateTag } from "next/cache";
import { z } from "zod";

import { appRuntime } from "@/db/runtime";
import { AgentService } from "@/lib/agents";
import { ChatService } from "@/lib/chat";
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
      yield* ChatService.assertAccess(ctx.auth.user.id, parsedInput.conversationId);
      yield* AgentService.assertOwnership(parsedInput.agentId, ctx.auth.user.id);
      yield* ChatService.updateAgent(parsedInput.conversationId, parsedInput.agentId);
    });

    const exit = await appRuntime.runPromiseExit(program);

    if (Exit.isFailure(exit)) {
      const { cause } = exit;

      if (
        cause._tag === "Fail" &&
        (cause.error._tag === "ForbiddenError" ||
          cause.error._tag === "ConversationNotFoundError" ||
          cause.error._tag === "AgentNotFoundError")
      ) {
        throw cause.error;
      }

      throw new Error("Failed to update conversation agent.");
    }

    updateTag(`conversations:${ctx.auth.user.id}`);

    return { agentId: parsedInput.agentId };
  });
