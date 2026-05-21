import { tool } from "ai";
import { Exit } from "effect";
import { z } from "zod";

import { appRuntime } from "@/db/service";
import { assertAgentOwnership } from "@/lib/agents";
import { getAgentCostRollup } from "@/lib/cost";
import { formatMicrodollars } from "@/lib/format-cost";

import type { ToolContext } from "../types";

const TOP_CONVERSATIONS = 20;

export const buildCostSummary = (_config: unknown, context: ToolContext) => {
  return tool({
    description:
      "Summarize an agent's chat spend without writing SQL: total cost, turn count, average cost per turn, a per-model breakdown, and the costliest conversations. Pass `since` as an ISO date to scope to a recent window. Costs are reported both as a USD string and as raw microdollars (USD x 1,000,000).",
    execute: async ({ agentId, since }) => {
      const ownership = await appRuntime.runPromiseExit(
        assertAgentOwnership(agentId, context.userId),
      );

      if (Exit.isFailure(ownership)) {
        return { error: "Agent not found or not owned by you." };
      }

      const rollup = await appRuntime.runPromise(
        getAgentCostRollup(agentId, context.userId, {
          since: since ? new Date(since) : undefined,
        }),
      );

      return {
        averageCostPerTurn: formatMicrodollars(rollup.averagePerTurnMicrodollars),
        averagePerTurnMicrodollars: rollup.averagePerTurnMicrodollars,
        byModel: rollup.byModel.map((entry) => {
          return {
            microdollars: entry.microdollars,
            modelId: entry.modelId,
            usd: formatMicrodollars(entry.microdollars),
          };
        }),
        topConversations: rollup.byConversation.slice(0, TOP_CONVERSATIONS).map((entry) => {
          return {
            conversationId: entry.conversationId,
            microdollars: entry.microdollars,
            title: entry.title,
            turnCount: entry.turnCount,
            usd: formatMicrodollars(entry.microdollars),
          };
        }),
        totalCost: formatMicrodollars(rollup.totalMicrodollars),
        totalMicrodollars: rollup.totalMicrodollars,
        turnCount: rollup.turnCount,
      };
    },
    inputSchema: z.object({
      agentId: z.string().min(1).describe("The ID of the agent to summarize cost for."),
      since: z
        .string()
        .refine((value) => !Number.isNaN(Date.parse(value)), {
          message: "since must be an ISO date string, e.g. 2025-01-01.",
        })
        .optional()
        .describe("Optional ISO date; only spend on or after this date is counted."),
    }),
  });
};
