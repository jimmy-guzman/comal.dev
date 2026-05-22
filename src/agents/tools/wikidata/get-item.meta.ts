import type { NoConfigShape, ToolMetadata } from "../meta";

import { deepFreeze, noConfigSchema } from "../meta";

export const wikidataGetItemMeta = {
  access: "read",
  configSchema: noConfigSchema,
  defaultConfig: deepFreeze({}),
  description: "Fetches a Wikidata item's labels, descriptions, statements, and sitelinks by Q-id.",
  group: "wikidata",
  id: "wikidata-get-item",
  name: "Wikidata item",
} satisfies ToolMetadata<NoConfigShape>;
