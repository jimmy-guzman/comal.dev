import { tool } from "ai";
import { z } from "zod";

import { MODEL_GROUPS } from "@/config/models";
import { appRuntime } from "@/db/runtime";
import { ModelPricingService } from "@/lib/model-pricing";

export const buildAgentsListModels = (_config: unknown, _context: unknown) => {
  return tool({
    description:
      "Returns all available model providers and their models that can be used as the default model for an agent. Includes output cost per 1M tokens in USD when available.",
    execute: async () => {
      const outputCosts = await appRuntime.runPromise(ModelPricingService.listOutputCosts());

      const groups = MODEL_GROUPS.map((g) => {
        return {
          label: g.label,
          models: g.models.map((m) => {
            return { id: m.id, name: m.name, outputCostPerMillion: outputCosts[m.id] };
          }),
          provider: g.provider,
        };
      });

      return { groups };
    },
    inputSchema: z.object({}),
  });
};
