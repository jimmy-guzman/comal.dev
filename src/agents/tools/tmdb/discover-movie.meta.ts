import type { NoConfigShape, ToolMetadata } from "../meta";

import { deepFreeze, noConfigSchema } from "../meta";

export const tmdbDiscoverMovieMeta = {
  access: "read",
  configSchema: noConfigSchema,
  defaultConfig: deepFreeze({}),
  description: "Discovers movies on TMDB by genre, year, language, and sort order.",
  group: "tmdb",
  id: "tmdb-discover-movie",
  name: "TMDB discover movies",
  requiredConnection: "tmdb",
} satisfies ToolMetadata<NoConfigShape>;
