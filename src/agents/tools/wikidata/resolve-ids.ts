import { tool } from "ai";
import { partition, Semaphore } from "es-toolkit";
import { z } from "zod";

import { getItem, getProperty } from "@/clients/wikidata";

import { WIKIDATA_BASE_URL, WIKIDATA_USER_AGENT } from "./client";

const CONCURRENCY = 8;

const ID_PATTERN = /^[QP][1-9]\d{0,9}$/u;

interface ResolvedEntity {
  description: null | string;
  id: string;
  label: null | string;
}

const pickValue = (values: Record<string, string> | undefined, language: string) => {
  if (!values) return null;

  const entries = Object.entries(values);
  const match =
    entries.find(([key]) => key === language) ??
    entries.find(([key]) => key === "en") ??
    entries.at(0);

  return match?.[1] ?? null;
};

const resolveOne = async (id: string, language: string): Promise<ResolvedEntity> => {
  const headers = { "User-Agent": WIKIDATA_USER_AGENT };

  const { data } = id.startsWith("P")
    ? await getProperty({
        baseUrl: WIKIDATA_BASE_URL,
        headers,
        path: { property_id: id },
        query: { _fields: ["labels", "descriptions"] },
      })
    : await getItem({
        baseUrl: WIKIDATA_BASE_URL,
        headers,
        path: { item_id: id },
        query: { _fields: ["labels", "descriptions"] },
      });

  return {
    description: pickValue(data?.descriptions, language),
    id,
    label: pickValue(data?.labels, language),
  };
};

const isResolved = (entity: ResolvedEntity) => entity.label !== null;

export const resolveWikidataIds = async ({
  ids,
  language,
}: {
  ids: string[];
  language: string;
}) => {
  const gate = new Semaphore(CONCURRENCY);

  const outcomes = await Promise.all(
    ids.map(async (id) => {
      await gate.acquire();

      try {
        return await resolveOne(id, language);
      } catch {
        return { description: null, id, label: null } satisfies ResolvedEntity;
      } finally {
        gate.release();
      }
    }),
  );

  const [resolved, failed] = partition(outcomes, isResolved);

  return {
    language,
    resolved,
    unresolved: failed.map((entity) => entity.id),
  };
};

const wikidataResolveIds = tool({
  description:
    "Resolve a batch of Wikidata ids (Q-ids and P-ids) to human-readable labels and descriptions. Use this to decipher the property keys and entity-valued statements returned by `wikidata-get-item`.",
  execute: ({ ids, language }) => resolveWikidataIds({ ids, language }),
  inputSchema: z.object({
    ids: z
      .array(z.string().regex(ID_PATTERN, "Must be a Wikidata Q-id or P-id, e.g. 'Q5' or 'P31'."))
      .min(1)
      .max(50)
      .describe("Wikidata entity ids to resolve (Q-ids and P-ids), up to 50."),
    language: z
      .string()
      .default("en")
      .describe("Preferred language for labels and descriptions. Defaults to 'en'."),
  }),
});

export const buildWikidataResolveIds = (_config: unknown, _context: unknown) => {
  return wikidataResolveIds;
};
