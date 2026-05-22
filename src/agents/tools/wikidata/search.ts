import { tool } from "ai";
import { z } from "zod";

import { simpleItemSearch } from "@/clients/wikidata";

import { WIKIDATA_BASE_URL, WIKIDATA_USER_AGENT } from "./client";

const wikidataSearch = tool({
  description:
    "Search Wikidata for entities (people, places, organizations, concepts, works) by name. Returns matching items with their Q-id, label, and short description. Pass a Q-id to `wikidata-get-item` for full details.",
  execute: async ({ language, limit, query }) => {
    const { data, error } = await simpleItemSearch({
      baseUrl: WIKIDATA_BASE_URL,
      headers: { "User-Agent": WIKIDATA_USER_AGENT },
      query: { language, limit, q: query },
    });

    if (error) {
      throw new Error(`Wikidata search failed: ${JSON.stringify(error)}`);
    }

    return data;
  },
  inputSchema: z.object({
    language: z
      .string()
      .default("en")
      .describe("Language code for labels and descriptions (e.g. 'en'). Defaults to 'en'."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .default(10)
      .describe("Maximum number of results (1-50). Defaults to 10."),
    query: z.string().min(1).describe("Term to match against entity labels and aliases."),
  }),
});

export const buildWikidataSearch = (_config: unknown, _context: unknown) => {
  return wikidataSearch;
};
