import { tool } from "ai";
import { z } from "zod";

import { movieDetails } from "@/clients/tmdb";
import { env } from "@/env";

export const tmdbMovieDetails = tool({
  description:
    "Fetch full TMDB details for a single movie by its TMDB id. Returns title, overview, runtime, release date, genres, production companies, and other top-level metadata. Use the id from `tmdb-search-multi`, `tmdb-trending-*`, or `tmdb-discover-movie` results.",
  execute: async ({ language, movieId }) => {
    const { data, error } = await movieDetails({
      auth: () => `Bearer ${env.TMDB_READ_ACCESS_TOKEN}`,
      path: { movie_id: movieId },
      query: { language },
    });

    if (error || !data) {
      throw new Error(`TMDB movie details failed: ${JSON.stringify(error ?? "no data")}`);
    }

    return data;
  },
  inputSchema: z.object({
    language: z.string().default("en-US").describe("ISO-639-1 language code (e.g. 'en-US')."),
    movieId: z.number().int().positive().describe("TMDB movie id."),
  }),
});
