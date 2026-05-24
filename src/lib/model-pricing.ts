import { inArray } from "drizzle-orm";
import { Effect } from "effect";

import { MODEL_IDS } from "@/config/models";
import { modelPricing } from "@/db/schemas/model-pricing-schema";
import { Database, runQuery } from "@/db/service";

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

        const map: Partial<Record<string, number>> = {};

        for (const row of rows) {
          const cost = Number.parseFloat(row.outputCost);

          if (Number.isFinite(cost) && cost >= 0) {
            map[row.modelId] = cost;
          }
        }

        return map;
      });

      return { listOutputCosts };
    }),
  },
) {}
