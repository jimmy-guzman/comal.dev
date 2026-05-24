import { tool } from "ai";
import { Effect } from "effect";
import { z } from "zod";

import type { ModelOutputCosts } from "@/lib/model-pricing";

import { MODEL_GROUPS } from "@/config/models";
import { appRuntime } from "@/db/runtime";
import { ModelPricingService } from "@/lib/model-pricing";

const EMPTY_OUTPUT_COSTS: ModelOutputCosts = {};

export const buildAgentsListModels = (_config: unknown, _context: unknown) => {
  return tool({
    description:
      "Returns all available model providers and their models that can be used as the default model for an agent. Includes output cost per 1M tokens in USD when available.",
    execute: async () => {
      const outputCosts = await appRuntime.runPromise(
        ModelPricingService.listOutputCosts().pipe(
          Effect.tapError((error) => {
            return Effect.logError("agents-list-models pricing lookup failed", error);
          }),
          Effect.catchAll(() => Effect.succeed(EMPTY_OUTPUT_COSTS)),
        ),
      );

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
