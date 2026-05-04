import { tool } from "ai";
import { Exit } from "effect";
import { z } from "zod";

import { appRuntime } from "@/db/service";
import { getAgentForUser } from "@/lib/agents";

import type { ToolContext } from "../types";

export const buildAgentsGet = (_config: unknown, context: ToolContext) => {
  return tool({
    description:
      "Returns the full configuration for a specific agent, including its tools, sub-agents, system prompt, and model.",
    execute: async ({ agentId }) => {
      const exit = await appRuntime.runPromiseExit(getAgentForUser(agentId, context.userId));

      if (Exit.isFailure(exit)) {
        return { error: "Agent not found or not owned by you." };
      }

      const agent = exit.value;

      return {
        defaultModelId: agent.defaultModelId,
        description: agent.description,
        id: agent.id,
        name: agent.name,
        subAgents: agent.subAgents.map((s) => {
          return {
            alias: s.alias,
            childAgentId: s.childAgentId,
            descriptionOverride: s.descriptionOverride,
          };
        }),
        systemPrompt: agent.systemPrompt,
        tools: agent.tools.map((t) => ({
          config: t.config,
          toolId: t.toolId,
        })),
      };
    },
    inputSchema: z.object({
      agentId: z.string().min(1).describe("The ID of the agent to retrieve."),
    }),
  });
};
