import type { NoConfigShape, ToolMetadata } from "../meta";

import { deepFreeze, noConfigSchema } from "../meta";

export const tmdbTrendingMoviesMeta = {
  access: "read",
  configSchema: noConfigSchema,
  defaultConfig: deepFreeze({}),
  description: "Lists trending movies on TMDB.",
  group: "tmdb",
  id: "tmdb-trending-movies",
  name: "TMDB trending movies",
  requiredConnection: "tmdb",
} satisfies ToolMetadata<NoConfigShape>;
