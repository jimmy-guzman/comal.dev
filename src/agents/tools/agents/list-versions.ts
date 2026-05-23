import { tool } from "ai";
import { Exit } from "effect";
import { z } from "zod";

import { appRuntime } from "@/db/runtime";
import { AgentService } from "@/lib/agents";

import type { ToolContext } from "../types";

export const buildAgentsListVersions = (_config: unknown, context: ToolContext) => {
  return tool({
    description:
      "List an agent's configuration version snapshots, newest first. Each version captures the model, system prompt, tools, sub-agents, and evals at that point in time.",
    execute: async ({ agentId }) => {
      const ownership = await appRuntime.runPromiseExit(
        AgentService.assertOwnership(agentId, context.userId),
      );

      if (Exit.isFailure(ownership)) {
        return { error: "Agent not found or not owned by you." };
      }

      const exit = await appRuntime.runPromiseExit(
        AgentService.listVersions(agentId, context.userId),
      );

      if (Exit.isFailure(exit)) {
        return { error: "Failed to list versions." };
      }

      const versions = exit.value;

      return { count: versions.length, versions };
    },
    inputSchema: z.object({
      agentId: z.string().min(1).describe("The ID of the agent whose versions to list."),
    }),
  });
};
