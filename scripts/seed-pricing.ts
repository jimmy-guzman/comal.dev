#!/usr/bin/env bun

/**
 * Fetches model pricing from OpenRouter's /api/v1/models endpoint
 * and upserts into the `model_pricing` table.
 *
 * Re-run when adding or changing models in `src/config/models.ts`.
 *
 * Usage: bun run scripts/seed-pricing.ts
 */

import "dotenv/config";

import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";

import { MODEL_IDS } from "../src/config/models";
import { modelPricing } from "../src/db/schemas/model-pricing-schema";

const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";

interface OpenRouterModel {
  id: string;
  pricing?: {
    completion?: string;
    prompt?: string;
  };
}

interface OpenRouterResponse {
  data: OpenRouterModel[];
}

const toPerMillion = (perToken: string): string => {
  return (Number.parseFloat(perToken) * 1_000_000).toFixed(6);
};

const main = async () => {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    // eslint-disable-next-line no-console -- CLI script
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  // eslint-disable-next-line no-console -- CLI script
  console.log("Fetching models from OpenRouter...");

  const response = await fetch(OPENROUTER_MODELS_URL);

  if (!response.ok) {
    // eslint-disable-next-line no-console -- CLI script
    console.error(`OpenRouter responded with ${response.status}`);
    process.exit(1);
  }

  const { data } = (await response.json()) as OpenRouterResponse;
  const modelIdSet = new Set<string>(MODEL_IDS);
  const matched: { inputCost: string; modelId: string; outputCost: string }[] = [];
  const missing: string[] = [];

  for (const modelId of modelIdSet) {
    const model = data.find((m) => m.id === modelId);

    if (!model?.pricing?.prompt || !model.pricing.completion) {
      missing.push(modelId);
      continue;
    }

    matched.push({
      inputCost: toPerMillion(model.pricing.prompt),
      modelId,
      outputCost: toPerMillion(model.pricing.completion),
    });
  }

  if (missing.length > 0) {
    // eslint-disable-next-line no-console -- CLI script
    console.warn(`Models not found or missing pricing: ${missing.join(", ")}`);
  }

  if (matched.length === 0) {
    // eslint-disable-next-line no-console -- CLI script
    console.error("No models matched. Nothing to upsert.");
    process.exit(1);
  }

  // eslint-disable-next-line no-console -- CLI script
  console.log(`Upserting pricing for ${matched.length} models...`);

  const db = drizzle({ connection: databaseUrl, ws });

  await db
    .insert(modelPricing)
    .values(
      matched.map((m) => {
        return { inputCost: m.inputCost, modelId: m.modelId, outputCost: m.outputCost };
      }),
    )
    .onConflictDoUpdate({
      set: {
        effectiveFrom: sql`now()`,
        inputCost: sql`excluded.input_cost`,
        outputCost: sql`excluded.output_cost`,
      },
      target: modelPricing.modelId,
    });

  for (const m of matched) {
    // eslint-disable-next-line no-console -- CLI script
    console.log(`  ${m.modelId}: $${m.inputCost} in / $${m.outputCost} out per 1M tokens`);
  }

  // eslint-disable-next-line no-console -- CLI script
  console.log("Done.");
  process.exit(0);
};

void main();
