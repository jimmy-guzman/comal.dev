import { tool } from "ai";
import { z } from "zod";

import { tools as toolRegistry } from "../registry";

export const buildAgentsListTools = (_config: unknown, _context: unknown) => {
  return tool({
    description:
      "Returns the full tool registry: all available tools that can be assigned to agents, including their IDs, names, descriptions, groups, and access levels.",
    execute: () => {
      const items = toolRegistry.list().map((t) => {
        return {
          access: t.access,
          description: t.description,
          group: t.group,
          id: t.id,
          name: t.name,
        };
      });

      return Promise.resolve({ count: items.length, tools: items });
    },
    inputSchema: z.object({}),
  });
};
