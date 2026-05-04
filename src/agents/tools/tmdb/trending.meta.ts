import type { NoConfigShape, ToolMetadata } from "../meta";

import { deepFreeze, noConfigSchema } from "../meta";

export const tmdbTrendingMeta = {
  access: "read",
  configSchema: noConfigSchema,
  defaultConfig: deepFreeze({}),
  description: "Lists what's trending across movies, TV, and people on TMDB.",
  group: "tmdb",
  id: "tmdb-trending",
  name: "TMDB trending",
} satisfies ToolMetadata<NoConfigShape>;
