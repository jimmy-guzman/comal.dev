import { tool } from "ai";
import { z } from "zod";

import { trendingMovies } from "@/clients/tmdb";
import { env } from "@/env";

export const tmdbTrendingMovies = tool({
  description:
    "Fetch the trending movies on TMDB for a given time window ('day' or 'week'). Use this when the user specifically asks about trending movies (not TV).",
  execute: async ({ language, timeWindow }) => {
    const { data, error } = await trendingMovies({
      auth: () => `Bearer ${env.TMDB_READ_ACCESS_TOKEN}`,
      path: { time_window: timeWindow },
      query: { language },
    });

    if (error || !data) {
      throw new Error(`TMDB trending movies failed: ${JSON.stringify(error ?? "no data")}`);
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
