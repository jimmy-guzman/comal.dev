import { embed, tool } from "ai";
import { z } from "zod";

import { appRuntime } from "@/db/runtime";
import { MemoryService } from "@/lib/memory";
import { platformOpenrouter } from "@/lib/openrouter";

import type { ToolContext } from "../types";

const EMBEDDING_MODEL_ID = "openai/text-embedding-3-small";

export const buildMemorySearch = (_config: unknown, context: ToolContext) => {
  return tool({
    description:
      "Search saved user memories by semantic similarity. Returns the top matches with similarity scores (0..1).",
    execute: async ({ limit, query }) => {
      try {
        const { embedding } = await embed({
          // eslint-disable-next-line @typescript-eslint/no-deprecated -- OpenRouter SDK still uses the v4-named API
          model: platformOpenrouter.textEmbeddingModel(EMBEDDING_MODEL_ID),
          value: query,
        });

        const hits = await appRuntime.runPromise(
          MemoryService.search(context.userId, embedding, { limit }),
        );

        return {
          matches: hits.map((hit) => {
            return {
              content: hit.content,
              id: hit.id,
              similarity: Number(hit.similarity.toFixed(3)),
            };
          }),
        };
      } catch {
        return { error: "Failed to search memory." };
      }
    },
    inputSchema: z.object({
      limit: z
        .number()
        .int()
        .min(1)
        .max(20)
        .optional()
        .describe("Maximum matches to return (1..20, default 5)."),
      query: z.string().trim().min(1).max(500).describe("What to search for."),
    }),
  });
};
