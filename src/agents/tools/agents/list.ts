import { tool } from "ai";
import { z } from "zod";

import { appRuntime } from "@/db/service";
import { listAgentsForUser } from "@/lib/agents";

import type { ToolContext } from "../types";

export const buildAgentsList = (_config: unknown, context: ToolContext) => {
  return tool({
    description: "Lists all agents owned by the current user, ordered by most recently updated.",
    execute: async () => {
      const agents = await appRuntime.runPromise(listAgentsForUser(context.userId));

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
