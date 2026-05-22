import { tool } from "ai";
import { z } from "zod";

import { getItem } from "@/clients/wikidata";

import { WIKIDATA_BASE_URL, WIKIDATA_USER_AGENT } from "./client";

const ITEM_FIELDS = [
  "type",
  "labels",
  "descriptions",
  "aliases",
  "statements",
  "sitelinks",
] as const;

const wikidataGetItem = tool({
  description:
    "Fetch a Wikidata item by its Q-id. Returns labels, descriptions, aliases, statements (facts as property/value pairs), and sitelinks (linked Wikipedia articles per language). Statements are keyed by property id (e.g. P31) and item-valued statements reference other Q-ids; pass those ids to `wikidata-resolve-ids` to turn them into readable labels.",
  execute: async ({ fields, itemId }) => {
    const { data, error } = await getItem({
      baseUrl: WIKIDATA_BASE_URL,
      headers: { "User-Agent": WIKIDATA_USER_AGENT },
      path: { item_id: itemId },
      query: { _fields: fields },
    });

    if (error || !data) {
      throw new Error(`Wikidata item fetch failed: ${JSON.stringify(error ?? "no data")}`);
    }

    return data;
  },
  inputSchema: z.object({
    fields: z
      .array(z.enum(ITEM_FIELDS))
      .optional()
      .describe("Which parts of the item to return. Omit to return all parts."),
    itemId: z
      .string()
      .regex(/^Q[1-9]\d{0,9}$/u, "Must be a Wikidata Q-id, e.g. 'Q42'.")
      .describe("The Wikidata item id (Q-id), e.g. 'Q42'."),
  }),
});

export const buildWikidataGetItem = (_config: unknown, _context: unknown) => {
  return wikidataGetItem;
};
