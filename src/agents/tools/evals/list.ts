import { tool } from "ai";
import { Exit } from "effect";
import { z } from "zod";

import { appRuntime } from "@/db/runtime";
import { AgentService } from "@/lib/agents";
import { EvalService } from "@/lib/evals";

import type { ToolContext } from "../types";

export const buildEvalsList = (_config: unknown, context: ToolContext) => {
  return tool({
    description:
      "List evals for an agent with their latest run summaries (score, output, rationale, per-trial aggregate).",
    execute: async ({ agentId }) => {
      const ownership = await appRuntime.runPromiseExit(
        AgentService.assertOwnership(agentId, context.userId),
      );

      if (Exit.isFailure(ownership)) {
        return { error: "Agent not found or not owned by you." };
      }

      const runs = await appRuntime.runPromise(EvalService.listRunsForAgent(agentId));

      return { count: runs.length, evals: runs };
    },
    inputSchema: z.object({
      agentId: z.string().min(1).describe("The ID of the agent whose evals to list."),
    }),
  });
};
