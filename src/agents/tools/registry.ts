import type { StandardSchemaV1 } from "@standard-schema/spec";

import { z } from "zod";

const groups = {
  core: { id: "core", label: "Core" },
  github: { id: "github", label: "GitHub" },
  tmdb: { id: "tmdb", label: "TMDB" },
  web: { id: "web", label: "Web" },
} as const satisfies Record<string, { id: string; label: string }>;

type ToolGroupId = keyof typeof groups;

interface ToolMetadata<TConfig = unknown> {
  configSchema: StandardSchemaV1<unknown, TConfig>;
  defaultConfig: TConfig;
  description: string;
  group: ToolGroupId;
  id: string;
  name: string;
}

const deepFreeze = <T>(value: T): T => {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
  }

  return value;
};

const noConfigSchema = z.object({}).strict();

type NoConfig = z.infer<typeof noConfigSchema>;

const approvalConfigSchema = z.object({
  needsApproval: z.boolean(),
});

type ApprovalConfig = z.infer<typeof approvalConfigSchema>;

const getCurrentTimeMeta = {
  configSchema: noConfigSchema,
  defaultConfig: deepFreeze({}),
  description: "Returns the current date and time in the user's timezone.",
  group: "core",
  id: "get-current-time",
  name: "Current time",
} satisfies ToolMetadata<NoConfig>;

const webFetchMeta = {
  configSchema: approvalConfigSchema,
  defaultConfig: deepFreeze({ needsApproval: true }),
  description: "Fetches the contents of a URL and returns it as markdown, text, or HTML.",
  group: "web",
  id: "web-fetch",
  name: "Web fetch",
} satisfies ToolMetadata<ApprovalConfig>;

const webSearchMeta = {
  configSchema: approvalConfigSchema,
  defaultConfig: deepFreeze({ needsApproval: false }),
  description: "Searches the web (via Tavily) and returns a list of titles, URLs, and snippets.",
  group: "web",
  id: "web-search",
  name: "Web search",
} satisfies ToolMetadata<ApprovalConfig>;

const githubReadMeta = {
  configSchema: noConfigSchema,
  defaultConfig: deepFreeze({}),
  description: "Reads files from public GitHub repositories in batch.",
  group: "github",
  id: "github-read",
  name: "GitHub read",
} satisfies ToolMetadata<NoConfig>;

const tmdbSearchMultiMeta = {
  configSchema: noConfigSchema,
  defaultConfig: deepFreeze({}),
  description: "Searches TMDB across movies, TV, and people in a single request.",
  group: "tmdb",
  id: "tmdb-search-multi",
  name: "TMDB search",
} satisfies ToolMetadata<NoConfig>;

const tmdbMovieDetailsMeta = {
  configSchema: noConfigSchema,
  defaultConfig: deepFreeze({}),
  description: "Fetches full TMDB metadata for a movie by id.",
  group: "tmdb",
  id: "tmdb-movie-details",
  name: "TMDB movie details",
} satisfies ToolMetadata<NoConfig>;

const tmdbTvDetailsMeta = {
  configSchema: noConfigSchema,
  defaultConfig: deepFreeze({}),
  description: "Fetches full TMDB metadata for a TV series by id.",
  group: "tmdb",
  id: "tmdb-tv-details",
  name: "TMDB TV details",
} satisfies ToolMetadata<NoConfig>;

const tmdbTrendingAllMeta = {
  configSchema: noConfigSchema,
  defaultConfig: deepFreeze({}),
  description: "Lists what's trending across movies, TV, and people on TMDB.",
  group: "tmdb",
  id: "tmdb-trending-all",
  name: "TMDB trending (all)",
} satisfies ToolMetadata<NoConfig>;

const tmdbTrendingMoviesMeta = {
  configSchema: noConfigSchema,
  defaultConfig: deepFreeze({}),
  description: "Lists trending movies on TMDB.",
  group: "tmdb",
  id: "tmdb-trending-movies",
  name: "TMDB trending movies",
} satisfies ToolMetadata<NoConfig>;

const tmdbTrendingTvMeta = {
  configSchema: noConfigSchema,
  defaultConfig: deepFreeze({}),
  description: "Lists trending TV series on TMDB.",
  group: "tmdb",
  id: "tmdb-trending-tv",
  name: "TMDB trending TV",
} satisfies ToolMetadata<NoConfig>;

const tmdbDiscoverMovieMeta = {
  configSchema: noConfigSchema,
  defaultConfig: deepFreeze({}),
  description: "Discovers movies on TMDB by genre, year, language, and sort order.",
  group: "tmdb",
  id: "tmdb-discover-movie",
  name: "TMDB discover movies",
} satisfies ToolMetadata<NoConfig>;

const tmdbDiscoverTvMeta = {
  configSchema: noConfigSchema,
  defaultConfig: deepFreeze({}),
  description: "Discovers TV series on TMDB by genre, first-air year, language, and sort order.",
  group: "tmdb",
  id: "tmdb-discover-tv",
  name: "TMDB discover TV",
} satisfies ToolMetadata<NoConfig>;

const metadata = Object.freeze([
  Object.freeze(getCurrentTimeMeta) as ToolMetadata,
  Object.freeze(webFetchMeta) as ToolMetadata,
  Object.freeze(webSearchMeta) as ToolMetadata,
  Object.freeze(githubReadMeta) as ToolMetadata,
  Object.freeze(tmdbSearchMultiMeta) as ToolMetadata,
  Object.freeze(tmdbMovieDetailsMeta) as ToolMetadata,
  Object.freeze(tmdbTvDetailsMeta) as ToolMetadata,
  Object.freeze(tmdbTrendingAllMeta) as ToolMetadata,
  Object.freeze(tmdbTrendingMoviesMeta) as ToolMetadata,
  Object.freeze(tmdbTrendingTvMeta) as ToolMetadata,
  Object.freeze(tmdbDiscoverMovieMeta) as ToolMetadata,
  Object.freeze(tmdbDiscoverTvMeta) as ToolMetadata,
]);

const byId = new Map(metadata.map((m) => [m.id, m]));

const groupList = Object.freeze(
  // eslint-disable-next-line arrow-style/arrow-return-style -- conflicts with prettier
  Object.values(groups).map((group) => {
    return Object.freeze({ ...group });
  }),
);

const groupedList = Object.freeze(
  groupList.map((group) => {
    return Object.freeze({
      group,
      items: Object.freeze(metadata.filter((tool) => tool.group === group.id)),
    });
  }),
);

export const tools = {
  get: (id: string) => byId.get(id),
  groups: () => groupList,
  list: () => metadata,
  listByGroup: () => groupedList,
};
