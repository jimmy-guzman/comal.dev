import type { NoConfigShape, ToolMetadata } from "../meta";

import { deepFreeze, noConfigSchema } from "../meta";

export const wikidataResolveIdsMeta = {
  access: "read",
  configSchema: noConfigSchema,
  defaultConfig: deepFreeze({}),
  description: "Resolves Wikidata Q-ids and P-ids to labels and descriptions in batch.",
  group: "wikidata",
  id: "wikidata-resolve-ids",
  name: "Wikidata resolve ids",
} satisfies ToolMetadata<NoConfigShape>;
