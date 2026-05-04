import type { NoConfigShape, ToolMetadata } from "../meta";

import { deepFreeze, noConfigSchema } from "../meta";

export const tmdbMovieDetailsMeta = {
  access: "read",
  configSchema: noConfigSchema,
  defaultConfig: deepFreeze({}),
  description: "Fetches full TMDB metadata for a movie by id.",
  group: "tmdb",
  id: "tmdb-movie-details",
  name: "TMDB movie details",
} satisfies ToolMetadata<NoConfigShape>;
