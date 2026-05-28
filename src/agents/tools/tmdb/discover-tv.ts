import { tool } from "ai";
import { z } from "zod";

import { discoverTv } from "@/clients/tmdb";

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
  "first_air_date.desc",
  "first_air_date.asc",
  "vote_average.desc",
  "vote_average.asc",
  "vote_count.desc",
  "vote_count.asc",
  "name.asc",
  "name.desc",
]);

const tmdbDiscoverTv = (context: ToolContext) => {
  return tool({
    description:
      "Discover TV series on TMDB by combining filters: sort order, genre ids, first-air year, first-air date range, and original language. Use `tmdb-search` first if you only have a name; use this when the user describes criteria (e.g. 'Japanese anime that started after 2020').",
    execute: async ({
      firstAirDateGte,
      firstAirDateLte,
      firstAirDateYear,
      page,
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

      const { data, error } = await discoverTv({
        auth: () => `Bearer ${token}`,
        query: {
          "first_air_date.gte": firstAirDateGte,
          "first_air_date.lte": firstAirDateLte,
          first_air_date_year: firstAirDateYear,
          page,
          sort_by: sortBy,
          with_genres: withGenres,
          with_original_language: withOriginalLanguage,
        },
      });

      if (error || !data) {
        throw new Error(`TMDB discover TV failed: ${JSON.stringify(error ?? "no data")}`);
      }

      return data;
    },
    inputSchema: z
      .object({
        firstAirDateGte: isoDate.optional().describe("Lower bound on first air date (YYYY-MM-DD)."),
        firstAirDateLte: isoDate.optional().describe("Upper bound on first air date (YYYY-MM-DD)."),
        firstAirDateYear: z
          .number()
          .int()
          .min(1880)
          .max(2100)
          .optional()
          .describe("Filter by first-air year."),
        page: z.number().int().min(1).max(500).default(1).describe("Page number (1-500)."),
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
        ({ firstAirDateGte, firstAirDateLte }) => {
          return !firstAirDateGte || !firstAirDateLte || firstAirDateGte <= firstAirDateLte;
        },
        {
          message: "firstAirDateGte must be on or before firstAirDateLte.",
          path: ["firstAirDateGte"],
        },
      ),
  });
};

export const buildTmdbDiscoverTv = (_config: unknown, context: ToolContext) => {
  return tmdbDiscoverTv(context);
};
