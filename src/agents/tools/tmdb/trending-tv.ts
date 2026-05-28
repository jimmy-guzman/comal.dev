import { tool } from "ai";
import { z } from "zod";

import { trendingTv } from "@/clients/tmdb";

import type { ToolContext } from "../types";

const tmdbTrendingTv = (context: ToolContext) => {
  return tool({
    description:
      "Fetch the trending TV series on TMDB for a given time window ('day' or 'week'). Use this when the user specifically asks about trending shows (not movies).",
    execute: async ({ language, timeWindow }) => {
      const token = await context.getCredential("tmdb");

      if (!token) {
        return {
          error:
            "TMDB is not configured for this user. Ask the user to set their TMDB read access token at /settings/connections, or contact the platform admin.",
        };
      }

      const { data, error } = await trendingTv({
        auth: () => `Bearer ${token}`,
        path: { time_window: timeWindow },
        query: { language },
      });

      if (error || !data) {
        throw new Error(`TMDB trending TV failed: ${JSON.stringify(error ?? "no data")}`);
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
};

export const buildTmdbTrendingTv = (_config: unknown, context: ToolContext) => {
  return tmdbTrendingTv(context);
};
