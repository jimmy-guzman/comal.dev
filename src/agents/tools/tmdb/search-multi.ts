import { tool } from "ai";
import { z } from "zod";

import { searchMulti } from "@/clients/tmdb";
import { env } from "@/env";

export const tmdbSearchMulti = tool({
  description:
    "Search TMDB for movies, TV shows, and people in a single call. Returns a paginated list of results, each tagged with `media_type` so you can branch on it. Use this when the user mentions a title or person without specifying the kind.",
  execute: async ({ includeAdult, language, page, query }) => {
    const { data, error } = await searchMulti({
      auth: () => `Bearer ${env.TMDB_READ_ACCESS_TOKEN}`,
      query: { include_adult: includeAdult, language, page, query },
    });

    if (error || !data) {
      throw new Error(`TMDB search failed: ${JSON.stringify(error ?? "no data")}`);
    }

    return data;
  },
  inputSchema: z.object({
    includeAdult: z
      .boolean()
      .default(false)
      .describe("Include adult content in results. Defaults to false."),
    language: z
      .string()
      .default("en-US")
      .describe("ISO-639-1 language code, optionally with region (e.g. 'en-US')."),
    page: z.number().int().min(1).max(500).default(1).describe("Page number (1-500)."),
    query: z.string().min(1).describe("Search query."),
  }),
});
