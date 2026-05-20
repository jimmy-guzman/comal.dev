import { tool } from "ai";
import { Exit } from "effect";
import { z } from "zod";

import { appRuntime } from "@/db/service";
import { getConversationTrace } from "@/lib/chat/store";
import { projectTrace } from "@/lib/chat/trace";

import type { ToolContext } from "../types";

export const buildTracesGet = (_config: unknown, context: ToolContext) => {
  return tool({
    description:
      "Get the projected execution trace for a conversation: ordered, timed steps with tool calls, inputs/outputs, errors, and token usage. Sub-agent steps are nested under their parent tool call.",
    execute: async ({ conversationId }) => {
      const exit = await appRuntime.runPromiseExit(
        getConversationTrace(context.userId, conversationId),
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
