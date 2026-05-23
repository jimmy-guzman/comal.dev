import { tool } from "ai";
import { Exit } from "effect";
import { z } from "zod";

import { appRuntime } from "@/db/runtime";
import { ChatStoreService } from "@/lib/chat/store";
import { projectTrace } from "@/lib/chat/trace";

import type { ToolContext } from "../types";

export const buildTracesGet = (_config: unknown, context: ToolContext) => {
  return tool({
    description:
      "Get the projected execution trace for a conversation: ordered, timed steps with tool calls, inputs/outputs, errors, and token usage. Sub-agent steps are nested under their parent tool call. Works for both chats and eval runs; for an eval run, pass the conversationId returned by evals-run.",
    execute: async ({ conversationId }) => {
      const exit = await appRuntime.runPromiseExit(
        ChatStoreService.getConversationTrace(context.userId, conversationId),
      );

      if (Exit.isFailure(exit)) {
        return { error: "Conversation not found or not owned by you." };
      }

      const trace = exit.value;

      return {
        conversationId: trace.id,
        modelId: trace.modelId,
        steps: projectTrace(trace.events, trace.conversationCreatedAt),
        title: trace.title,
      };
    },
    inputSchema: z.object({
      conversationId: z.string().min(1).describe("The ID of the conversation to trace."),
    }),
  });
};
