import { tool } from "ai";
import { z } from "zod";

import { discoverMovie } from "@/clients/tmdb";

import type { ToolContext } from "../types";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format.")
  .refine((value) => {
    const [year, month, day] = value.split("-").map(Number) as [number, number, number];
    const date = new Date(Date.UTC(year, month - 1, day));

    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  }, "Date is not a valid calendar date.");

const sortByEnum = z.enum([
  "popularity.desc",
  "popularity.asc",
  "primary_release_date.desc",
  "primary_release_date.asc",
  "vote_average.desc",
  "vote_average.asc",
  "vote_count.desc",
  "vote_count.asc",
  "revenue.desc",
  "revenue.asc",
]);

const tmdbDiscoverMovie = (context: ToolContext) => {
  return tool({
    description:
      "Discover movies on TMDB by combining filters: sort order, genre ids, year, release-date range, and original language. Use `tmdb-search` first if you only have a title or name; use this when the user describes criteria (e.g. 'horror movies from 2023').",
    execute: async ({
      page,
      primaryReleaseDateGte,
      primaryReleaseDateLte,
      primaryReleaseYear,
      sortBy,
      withGenres,
      withOriginalLanguage,
    }) => {
      const token = await context.getCredential("tmdb");

      if (!token) {
        return {
          error:
            "TMDB is not configured for this user. Ask the user to set their TMDB read access token at /settings/connections, or contact the platform admin.",
        };
      }

      const { data, error } = await discoverMovie({
        auth: () => `Bearer ${token}`,
        query: {
          page,
          "primary_release_date.gte": primaryReleaseDateGte,
          "primary_release_date.lte": primaryReleaseDateLte,
          primary_release_year: primaryReleaseYear,
          sort_by: sortBy,
          with_genres: withGenres,
          with_original_language: withOriginalLanguage,
        },
      });

      if (error || !data) {
        throw new Error(`TMDB discover movie failed: ${JSON.stringify(error ?? "no data")}`);
      }

      return data;
    },
    inputSchema: z
      .object({
        page: z.number().int().min(1).max(500).default(1).describe("Page number (1-500)."),
        primaryReleaseDateGte: isoDate
          .optional()
          .describe("Lower bound on primary release date (YYYY-MM-DD)."),
        primaryReleaseDateLte: isoDate
          .optional()
          .describe("Upper bound on primary release date (YYYY-MM-DD)."),
        primaryReleaseYear: z
          .number()
          .int()
          .min(1880)
          .max(2100)
          .optional()
          .describe("Filter by primary release year."),
        sortBy: sortByEnum
          .default("popularity.desc")
          .describe("Sort order. Defaults to popularity.desc."),
        withGenres: z
          .string()
          .optional()
          .describe("Comma-separated (AND) or pipe-separated (OR) TMDB genre ids."),
        withOriginalLanguage: z
          .string()
          .optional()
          .describe("ISO-639-1 original language code (e.g. 'ja')."),
      })
      .refine(
        ({ primaryReleaseDateGte, primaryReleaseDateLte }) => {
          return (
            !primaryReleaseDateGte ||
            !primaryReleaseDateLte ||
            primaryReleaseDateGte <= primaryReleaseDateLte
          );
        },
        {
          message: "primaryReleaseDateGte must be on or before primaryReleaseDateLte.",
          path: ["primaryReleaseDateGte"],
        },
      ),
  });
};

export const buildTmdbDiscoverMovie = (_config: unknown, context: ToolContext) => {
  return tmdbDiscoverMovie(context);
};
