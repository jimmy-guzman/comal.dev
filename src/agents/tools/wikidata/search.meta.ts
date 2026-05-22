import type { NoConfigShape, ToolMetadata } from "../meta";

import { deepFreeze, noConfigSchema } from "../meta";

export const wikidataSearchMeta = {
  access: "read",
  configSchema: noConfigSchema,
  defaultConfig: deepFreeze({}),
  description: "Searches Wikidata for entities by label and aliases.",
  group: "wikidata",
  id: "wikidata-search",
  name: "Wikidata search",
} satisfies ToolMetadata<NoConfigShape>;
