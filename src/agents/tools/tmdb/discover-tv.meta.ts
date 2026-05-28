import type { NoConfigShape, ToolMetadata } from "../meta";

import { deepFreeze, noConfigSchema } from "../meta";

export const tmdbDiscoverTvMeta = {
  access: "read",
  configSchema: noConfigSchema,
  defaultConfig: deepFreeze({}),
  description: "Discovers TV series on TMDB by genre, first-air year, language, and sort order.",
  group: "tmdb",
  id: "tmdb-discover-tv",
  name: "TMDB discover TV",
  requiredConnection: "tmdb",
} satisfies ToolMetadata<NoConfigShape>;
