import { tool } from "ai";
import { z } from "zod";

import { tvSeriesDetails } from "@/clients/tmdb";

import type { ToolContext } from "../types";

const tmdbTvDetails = (context: ToolContext) => {
  return tool({
    description:
      "Fetch full TMDB details for a single TV series by its TMDB id. Returns name, overview, season list, networks, status, first/last air dates, and other top-level metadata. Use the id from `tmdb-search`, `tmdb-trending`, `tmdb-trending-tv`, or `tmdb-discover-tv` results.",
    execute: async ({ language, seriesId }) => {
      const token = await context.getCredential("tmdb");

      if (!token) {
        return {
          error:
            "TMDB is not configured for this user. Ask the user to set their TMDB read access token at /settings/connections, or contact the platform admin.",
        };
      }

      const { data, error } = await tvSeriesDetails({
        auth: () => `Bearer ${token}`,
        path: { series_id: seriesId },
        query: { language },
      });

      if (error || !data) {
        throw new Error(`TMDB TV details failed: ${JSON.stringify(error ?? "no data")}`);
      }

      return data;
    },
    inputSchema: z.object({
      language: z.string().default("en-US").describe("ISO-639-1 language code (e.g. 'en-US')."),
      seriesId: z.number().int().positive().describe("TMDB TV series id."),
    }),
  });
};

export const buildTmdbTvDetails = (_config: unknown, context: ToolContext) => {
  return tmdbTvDetails(context);
};
