import type { ToolMetadata } from "./meta";

import { coreNowMeta } from "./core/now.meta";
import { githubReadMeta } from "./github/read.meta";
import { groups } from "./meta";
import { tmdbDiscoverMovieMeta } from "./tmdb/discover-movie.meta";
import { tmdbDiscoverTvMeta } from "./tmdb/discover-tv.meta";
import { tmdbMovieDetailsMeta } from "./tmdb/movie-details.meta";
import { tmdbSearchMeta } from "./tmdb/search.meta";
import { tmdbTrendingMoviesMeta } from "./tmdb/trending-movies.meta";
import { tmdbTrendingTvMeta } from "./tmdb/trending-tv.meta";
import { tmdbTrendingMeta } from "./tmdb/trending.meta";
import { tmdbTvDetailsMeta } from "./tmdb/tv-details.meta";
import { webFetchMeta } from "./web/fetch.meta";
import { webSearchMeta } from "./web/search.meta";

const metadata = Object.freeze([
  Object.freeze(coreNowMeta) as ToolMetadata,
  Object.freeze(githubReadMeta) as ToolMetadata,
  Object.freeze(tmdbDiscoverMovieMeta) as ToolMetadata,
  Object.freeze(tmdbDiscoverTvMeta) as ToolMetadata,
  Object.freeze(tmdbMovieDetailsMeta) as ToolMetadata,
  Object.freeze(tmdbSearchMeta) as ToolMetadata,
  Object.freeze(tmdbTrendingMeta) as ToolMetadata,
  Object.freeze(tmdbTrendingMoviesMeta) as ToolMetadata,
  Object.freeze(tmdbTrendingTvMeta) as ToolMetadata,
  Object.freeze(tmdbTvDetailsMeta) as ToolMetadata,
  Object.freeze(webFetchMeta) as ToolMetadata,
  Object.freeze(webSearchMeta) as ToolMetadata,
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
