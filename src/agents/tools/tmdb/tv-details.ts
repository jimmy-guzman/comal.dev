import { tool } from "ai";
import { z } from "zod";

import { tvSeriesDetails } from "@/clients/tmdb";
import { env } from "@/env";

const tmdbTvDetails = tool({
  description:
    "Fetch full TMDB details for a single TV series by its TMDB id. Returns name, overview, season list, networks, status, first/last air dates, and other top-level metadata. Use the id from `tmdb-search`, `tmdb-trending`, `tmdb-trending-tv`, or `tmdb-discover-tv` results.",
  execute: async ({ language, seriesId }) => {
    const { data, error } = await tvSeriesDetails({
      auth: () => `Bearer ${env.TMDB_READ_ACCESS_TOKEN}`,
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

export const buildTmdbTvDetails = () => {
  return tmdbTvDetails;
};
