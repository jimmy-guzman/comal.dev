import { tool } from "ai";
import { z } from "zod";

import { trendingAll } from "@/clients/tmdb";
import { env } from "@/env";

const tmdbTrending = tool({
  description:
    "Fetch what's currently trending across movies, TV, and people on TMDB for a given time window ('day' or 'week'). Each result is tagged with `media_type`. Use this for general 'what's hot right now' questions.",
  execute: async ({ language, timeWindow }) => {
    const { data, error } = await trendingAll({
      auth: () => `Bearer ${env.TMDB_READ_ACCESS_TOKEN}`,
      path: { time_window: timeWindow },
      query: { language },
    });

    if (error || !data) {
      throw new Error(`TMDB trending failed: ${JSON.stringify(error ?? "no data")}`);
    }

    return data;
  },
  inputSchema: z.object({
    language: z.string().default("en-US").describe("ISO-639-1 language code (e.g. 'en-US')."),
    timeWindow: z
      .enum(["day", "week"])
      .default("week")
      .describe("Trending window. Defaults to 'week'."),
  }),
});

export const buildTmdbTrending = (_config: unknown, _context: unknown) => {
  return tmdbTrending;
};
