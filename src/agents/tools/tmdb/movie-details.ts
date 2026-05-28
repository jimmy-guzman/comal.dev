import { tool } from "ai";
import { z } from "zod";

import { movieDetails } from "@/clients/tmdb";

import type { ToolContext } from "../types";

const tmdbMovieDetails = (context: ToolContext) => {
  return tool({
    description:
      "Fetch full TMDB details for a single movie by its TMDB id. Returns title, overview, runtime, release date, genres, production companies, and other top-level metadata. Use the id from `tmdb-search`, `tmdb-trending`, `tmdb-trending-movies`, or `tmdb-discover-movie` results.",
    execute: async ({ language, movieId }) => {
      const token = await context.getCredential("tmdb");

      if (!token) {
        return {
          error:
            "TMDB is not configured for this user. Ask the user to set their TMDB read access token at /settings/connections, or contact the platform admin.",
        };
      }

      const { data, error } = await movieDetails({
        auth: () => `Bearer ${token}`,
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
};

export const buildTmdbMovieDetails = (_config: unknown, context: ToolContext) => {
  return tmdbMovieDetails(context);
};
