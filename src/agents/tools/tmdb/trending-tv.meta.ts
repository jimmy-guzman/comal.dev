import type { NoConfigShape, ToolMetadata } from "../meta";

import { deepFreeze, noConfigSchema } from "../meta";

export const tmdbTrendingTvMeta = {
  access: "read",
  configSchema: noConfigSchema,
  defaultConfig: deepFreeze({}),
  description: "Lists trending TV series on TMDB.",
  group: "tmdb",
  id: "tmdb-trending-tv",
  name: "TMDB trending TV",
} satisfies ToolMetadata<NoConfigShape>;
