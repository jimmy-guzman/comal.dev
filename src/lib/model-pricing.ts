import { inArray } from "drizzle-orm";
import { Effect } from "effect";

import type { ModelId } from "@/config/models";

import { MODEL_IDS } from "@/config/models";
import { modelPricing } from "@/db/schemas/model-pricing-schema";
import { Database, runQuery } from "@/db/service";

export type ModelOutputCosts = Partial<Record<ModelId, number>>;

const isModelId = (value: string): value is ModelId => {
  return (MODEL_IDS as readonly string[]).includes(value);
};

export class ModelPricingService extends Effect.Service<ModelPricingService>()(
  "ModelPricingService",
  {
    accessors: true,
    effect: Effect.gen(function* () {
      const db = yield* Database;

      const listOutputCosts = Effect.fn("ModelPricingService.listOutputCosts")(function* () {
        const rows = yield* runQuery(() => {
          return db
            .select({ modelId: modelPricing.modelId, outputCost: modelPricing.outputCost })
            .from(modelPricing)
            .where(inArray(modelPricing.modelId, [...MODEL_IDS]));
        });

        const map: ModelOutputCosts = {};

        for (const row of rows) {
          const cost = Number.parseFloat(row.outputCost);

          if (Number.isFinite(cost) && cost >= 0 && isModelId(row.modelId)) {
            map[row.modelId] = cost;
          }
        }

        return map;
      });

      return { listOutputCosts };
    }),
  },
) {}
