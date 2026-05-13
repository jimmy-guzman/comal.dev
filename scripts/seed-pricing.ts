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
import { z } from "zod";

import { MODEL_IDS } from "../src/config/models";
import { modelPricing } from "../src/db/schemas/model-pricing-schema";

const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";

const openRouterResponseSchema = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      pricing: z
        .object({
          completion: z.string(),
          prompt: z.string(),
        })
        .partial()
        .optional(),
    }),
  ),
});

const toPerMillion = (perToken: string): null | string => {
  const parsed = Number.parseFloat(perToken);

  if (!Number.isFinite(parsed)) return null;

  if (parsed < 0) return null;

  return (parsed * 1_000_000).toFixed(6);
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

  const controller = new AbortController();
  const timer = setTimeout(() => { controller.abort(); }, 10_000);

  let response: Response;

  try {
    response = await fetch(OPENROUTER_MODELS_URL, { signal: controller.signal });
  } catch (error) {
    // eslint-disable-next-line no-console -- CLI script
    console.error(
      `Failed to fetch from OpenRouter: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    // eslint-disable-next-line no-console -- CLI script
    console.error(`OpenRouter responded with ${response.status}`);
    process.exit(1);
  }

  const parsed = openRouterResponseSchema.safeParse(await response.json());

  if (!parsed.success) {
    // eslint-disable-next-line no-console -- CLI script
    console.error("Unexpected response shape from OpenRouter");
    process.exit(1);
  }

  const { data } = parsed.data;
  const modelIdSet = new Set<string>(MODEL_IDS);
  const matched: { inputCost: string; modelId: string; outputCost: string }[] = [];
  const missing: string[] = [];

  for (const modelId of modelIdSet) {
    const model = data.find((m) => m.id === modelId);

    if (model?.pricing?.prompt === undefined || model.pricing.completion === undefined) {
      missing.push(modelId);
      continue;
    }

    const inputCost = toPerMillion(model.pricing.prompt);
    const outputCost = toPerMillion(model.pricing.completion);

    if (inputCost === null || outputCost === null) {
      missing.push(modelId);
      continue;
    }

    matched.push({ inputCost, modelId, outputCost });
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
