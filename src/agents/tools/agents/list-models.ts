import { tool } from "ai";
import { z } from "zod";

import { MODEL_GROUPS } from "@/config/models";

export const buildAgentsListModels = (_config: unknown, _context: unknown) => {
  return tool({
    description:
      "Returns all available model providers and their models that can be used as the default model for an agent.",
    execute: () => {
      const groups = MODEL_GROUPS.map((g) => {
        return {
          label: g.label,
          models: g.models.map((m) => ({ id: m.id, name: m.name })),
          provider: g.provider,
        };
      });

      return Promise.resolve({ groups });
    },
    inputSchema: z.object({}),
  });
};
