import { tool } from "ai";
import { Exit } from "effect";
import { z } from "zod";

import { appRuntime } from "@/db/runtime";
import { AgentService } from "@/lib/agents";
import { EvalService } from "@/lib/evals";

import type { ToolContext } from "../types";

export const buildEvalsGetHistory = (_config: unknown, context: ToolContext) => {
  return tool({
    description:
      "List historical eval runs for an agent, newest first and paginated. Optionally filter to one eval by evalId. Returns runs (each with score, output, rationale, the agent version it ran against, and the trace conversationId) plus a nextCursor when more results exist.",
    execute: async ({ agentId, cursor, evalId, limit }) => {
      const ownership = await appRuntime.runPromiseExit(
        AgentService.assertOwnership(agentId, context.userId),
      );

      if (Exit.isFailure(ownership)) {
        return { error: "Agent not found or not owned by you." };
      }

      return appRuntime.runPromise(EvalService.listRunHistory(agentId, { cursor, evalId, limit }));
    },
    inputSchema: z.object({
      agentId: z.string().min(1).describe("The ID of the agent whose eval runs to list."),
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
      evalId: z
        .string()
        .min(1)
        .optional()
        .describe("Optional eval ID to restrict the history to a single eval."),
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .describe("Max runs to return (1-100, default 20)."),
    }),
  });
};
