import { tool } from "ai";
import { Exit } from "effect";
import { z } from "zod";

import { appRuntime } from "@/db/runtime";
import { AgentService } from "@/lib/agents";

import type { ToolContext } from "../types";

export const buildAgentsList = (_config: unknown, context: ToolContext) => {
  return tool({
    description: "Lists all agents owned by the current user, ordered by most recently updated.",
    execute: async () => {
      const exit = await appRuntime.runPromiseExit(AgentService.listForUser(context.userId));

      if (Exit.isFailure(exit)) {
        return { error: "Failed to list agents." };
      }

      const agents = exit.value;

      return {
        agents: agents.map((a) => {
          return {
            defaultModelId: a.defaultModelId,
            description: a.description,
            id: a.id,
            isSystem: a.isSystem,
            name: a.name,
          };
        }),
        count: agents.length,
      };
    },
    inputSchema: z.object({}),
  });
};
