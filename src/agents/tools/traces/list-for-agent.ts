import { tool } from "ai";
import { Exit } from "effect";
import { z } from "zod";

import { appRuntime } from "@/db/service";
import { assertAgentOwnership } from "@/lib/agents";
import { listTracesForAgent } from "@/lib/chat/store";

import type { ToolContext } from "../types";

export const buildTracesListForAgent = (_config: unknown, context: ToolContext) => {
  return tool({
    description:
      "List recent chat conversations for an agent with aggregated start/end time, event count, and total cost. Eval runs are excluded; reach an eval run's trace through the conversationId returned by evals-run. Use traces-get for the full per-step timeline of one conversation.",
    execute: async ({ agentId, cursor, limit }) => {
      const ownership = await appRuntime.runPromiseExit(
        assertAgentOwnership(agentId, context.userId),
      );

      if (Exit.isFailure(ownership)) {
        return { error: "Agent not found or not owned by you." };
      }

      return appRuntime.runPromise(listTracesForAgent(agentId, context.userId, { cursor, limit }));
    },
    inputSchema: z.object({
      agentId: z.string().min(1).describe("The ID of the agent whose traces to list."),
      cursor: z
        .string()
        .refine(
          (value) => {
            const separator = value.indexOf("|");

            return (
              separator > 0 &&
              separator < value.length - 1 &&
              !Number.isNaN(Date.parse(value.slice(0, separator)))
            );
          },
          {
            message: "cursor must be a value returned verbatim from a previous call's nextCursor.",
          },
        )
        .optional()
        .describe("Pagination cursor copied verbatim from a previous call's nextCursor."),
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .describe("Max conversations to return (1-100, default 20)."),
    }),
  });
};
