import type { Tool } from "ai";

import { buildCoreNow } from "./core/now";
import { coreNowMeta } from "./core/now.meta";
import { buildGithubRead } from "./github/read";
import { githubReadMeta } from "./github/read.meta";
import { buildTmdbDiscoverMovie } from "./tmdb/discover-movie";
import { tmdbDiscoverMovieMeta } from "./tmdb/discover-movie.meta";
import { buildTmdbDiscoverTv } from "./tmdb/discover-tv";
import { tmdbDiscoverTvMeta } from "./tmdb/discover-tv.meta";
import { buildTmdbMovieDetails } from "./tmdb/movie-details";
import { tmdbMovieDetailsMeta } from "./tmdb/movie-details.meta";
import { buildTmdbSearch } from "./tmdb/search";
import { tmdbSearchMeta } from "./tmdb/search.meta";
import { buildTmdbTrending } from "./tmdb/trending";
import { buildTmdbTrendingMovies } from "./tmdb/trending-movies";
import { tmdbTrendingMoviesMeta } from "./tmdb/trending-movies.meta";
import { buildTmdbTrendingTv } from "./tmdb/trending-tv";
import { tmdbTrendingTvMeta } from "./tmdb/trending-tv.meta";
import { tmdbTrendingMeta } from "./tmdb/trending.meta";
import { buildTmdbTvDetails } from "./tmdb/tv-details";
import { tmdbTvDetailsMeta } from "./tmdb/tv-details.meta";
import { buildWebFetch } from "./web/fetch";
import { webFetchMeta } from "./web/fetch.meta";
import { buildWebSearch } from "./web/search";
import { webSearchMeta } from "./web/search.meta";

const builders = new Map<string, (config: unknown) => Tool>([
  [coreNowMeta.id, buildCoreNow],
  [githubReadMeta.id, buildGithubRead],
  [tmdbDiscoverMovieMeta.id, buildTmdbDiscoverMovie],
  [tmdbDiscoverTvMeta.id, buildTmdbDiscoverTv],
  [tmdbMovieDetailsMeta.id, buildTmdbMovieDetails],
  [tmdbSearchMeta.id, buildTmdbSearch],
  [tmdbTrendingMeta.id, buildTmdbTrending],
  [tmdbTrendingMoviesMeta.id, buildTmdbTrendingMovies],
  [tmdbTrendingTvMeta.id, buildTmdbTrendingTv],
  [tmdbTvDetailsMeta.id, buildTmdbTvDetails],
  [webFetchMeta.id, buildWebFetch],
  [webSearchMeta.id, buildWebSearch],
]);

export const buildTool = (id: string, config: unknown) => {
  return builders.get(id)?.(config);
};
