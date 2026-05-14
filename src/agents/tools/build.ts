import type { Tool } from "ai";

import type { ToolContext } from "./types";

import { buildAgentsCreate } from "./agents/create";
import { buildAgentsDelete } from "./agents/delete";
import { buildAgentsGet } from "./agents/get";
import { buildAgentsList } from "./agents/list";
import { buildAgentsListModels } from "./agents/list-models";
import { buildAgentsListTools } from "./agents/list-tools";
import { buildAgentsUpdate } from "./agents/update";
import { buildCoreNow } from "./core/now";
import { buildGithubRead } from "./github/read";
import { buildTmdbDiscoverMovie } from "./tmdb/discover-movie";
import { buildTmdbDiscoverTv } from "./tmdb/discover-tv";
import { buildTmdbMovieDetails } from "./tmdb/movie-details";
import { buildTmdbSearch } from "./tmdb/search";
import { buildTmdbTrending } from "./tmdb/trending";
import { buildTmdbTrendingMovies } from "./tmdb/trending-movies";
import { buildTmdbTrendingTv } from "./tmdb/trending-tv";
import { buildTmdbTvDetails } from "./tmdb/tv-details";
import { buildWebFetch } from "./web/fetch";
import { buildWebSearch } from "./web/search";

const BUILDERS = {
  "agents-create": buildAgentsCreate,
  "agents-delete": buildAgentsDelete,
  "agents-get": buildAgentsGet,
  "agents-list": buildAgentsList,
  "agents-list-models": buildAgentsListModels,
  "agents-list-tools": buildAgentsListTools,
  "agents-update": buildAgentsUpdate,
  "core-now": buildCoreNow,
  "github-read": buildGithubRead,
  "tmdb-discover-movie": buildTmdbDiscoverMovie,
  "tmdb-discover-tv": buildTmdbDiscoverTv,
  "tmdb-movie-details": buildTmdbMovieDetails,
  "tmdb-search": buildTmdbSearch,
  "tmdb-trending": buildTmdbTrending,
  "tmdb-trending-movies": buildTmdbTrendingMovies,
  "tmdb-trending-tv": buildTmdbTrendingTv,
  "tmdb-tv-details": buildTmdbTvDetails,
  "web-fetch": buildWebFetch,
  "web-search": buildWebSearch,
} satisfies Record<string, (config: unknown, context: ToolContext) => Tool>;

const builders = new Map(Object.entries(BUILDERS));

export const buildTool = (id: string, config: unknown, context: ToolContext) => {
  return builders.get(id)?.(config, context);
};

export type BuiltinToolSet = Record<keyof typeof BUILDERS, Tool>;
