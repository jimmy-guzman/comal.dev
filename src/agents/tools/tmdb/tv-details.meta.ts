import type { NoConfigShape, ToolMetadata } from "../meta";

import { deepFreeze, noConfigSchema } from "../meta";

export const tmdbTvDetailsMeta = {
  access: "read",
  configSchema: noConfigSchema,
  defaultConfig: deepFreeze({}),
  description: "Fetches full TMDB metadata for a TV series by id.",
  group: "tmdb",
  id: "tmdb-tv-details",
  name: "TMDB TV details",
  requiredConnection: "tmdb",
} satisfies ToolMetadata<NoConfigShape>;
