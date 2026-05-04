import type { NoConfigShape, ToolMetadata } from "../meta";

import { deepFreeze, noConfigSchema } from "../meta";

export const tmdbSearchMeta = {
  access: "read",
  configSchema: noConfigSchema,
  defaultConfig: deepFreeze({}),
  description: "Searches TMDB across movies, TV, and people in a single request.",
  group: "tmdb",
  id: "tmdb-search",
  name: "TMDB search",
} satisfies ToolMetadata<NoConfigShape>;
