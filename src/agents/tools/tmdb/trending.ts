import { tool } from "ai";
import { z } from "zod";

import { trendingAll } from "@/clients/tmdb";

import type { ToolContext } from "../types";

const tmdbTrending = (context: ToolContext) => {
  return tool({
    description:
      "Fetch what's currently trending across movies, TV, and people on TMDB for a given time window ('day' or 'week'). Each result is tagged with `media_type`. Use this for general 'what's hot right now' questions.",
    execute: async ({ language, timeWindow }) => {
      const token = await context.getCredential("tmdb");

      if (!token) {
        return {
          error:
            "TMDB is not configured for this user. Ask the user to set their TMDB read access token at /settings/connections, or contact the platform admin.",
        };
      }

      const { data, error } = await trendingAll({
        auth: () => `Bearer ${token}`,
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
};

export const buildTmdbTrending = (_config: unknown, context: ToolContext) => {
  return tmdbTrending(context);
};
