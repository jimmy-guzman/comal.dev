import type { Tool } from "ai";

import type { ToolContext } from "./types";

import { buildAgentsCreate } from "./agents/create";
import { buildAgentsDelete } from "./agents/delete";
import { buildAgentsDiffVersions } from "./agents/diff-versions";
import { buildAgentsGet } from "./agents/get";
import { buildAgentsList } from "./agents/list";
import { buildAgentsListModels } from "./agents/list-models";
import { buildAgentsListTools } from "./agents/list-tools";
import { buildAgentsListVersions } from "./agents/list-versions";
import { buildAgentsRevertToVersion } from "./agents/revert-to-version";
import { buildAgentsUpdate } from "./agents/update";
import { buildCoreNow } from "./core/now";
import { buildCostSummary } from "./cost/summary";
import { buildEvalsCreate } from "./evals/create";
import { buildEvalsDelete } from "./evals/delete";
import { buildEvalsGetHistory } from "./evals/get-history";
import { buildEvalsList } from "./evals/list";
import { buildEvalsRun } from "./evals/run";
import { buildEvalsRunBatch } from "./evals/run-batch";
import { buildEvalsUpdate } from "./evals/update";
import { buildGithubRead } from "./github/read";
import { buildTmdbDiscoverMovie } from "./tmdb/discover-movie";
import { buildTmdbDiscoverTv } from "./tmdb/discover-tv";
import { buildTmdbMovieDetails } from "./tmdb/movie-details";
import { buildTmdbSearch } from "./tmdb/search";
import { buildTmdbTrending } from "./tmdb/trending";
import { buildTmdbTrendingMovies } from "./tmdb/trending-movies";
import { buildTmdbTrendingTv } from "./tmdb/trending-tv";
import { buildTmdbTvDetails } from "./tmdb/tv-details";
import { buildTracesGet } from "./traces/get";
import { buildTracesListForAgent } from "./traces/list-for-agent";
import { buildWebFetch } from "./web/fetch";
import { buildWebSearch } from "./web/search";

const BUILDERS = {
  "agents-create": buildAgentsCreate,
  "agents-delete": buildAgentsDelete,
  "agents-diff-versions": buildAgentsDiffVersions,
  "agents-get": buildAgentsGet,
  "agents-list": buildAgentsList,
  "agents-list-models": buildAgentsListModels,
  "agents-list-tools": buildAgentsListTools,
  "agents-list-versions": buildAgentsListVersions,
  "agents-revert-to-version": buildAgentsRevertToVersion,
  "agents-update": buildAgentsUpdate,
  "core-now": buildCoreNow,
  "cost-summary": buildCostSummary,
  "evals-create": buildEvalsCreate,
  "evals-delete": buildEvalsDelete,
  "evals-get-history": buildEvalsGetHistory,
  "evals-list": buildEvalsList,
  "evals-run": buildEvalsRun,
  "evals-run-batch": buildEvalsRunBatch,
  "evals-update": buildEvalsUpdate,
  "github-read": buildGithubRead,
  "tmdb-discover-movie": buildTmdbDiscoverMovie,
  "tmdb-discover-tv": buildTmdbDiscoverTv,
  "tmdb-movie-details": buildTmdbMovieDetails,
  "tmdb-search": buildTmdbSearch,
  "tmdb-trending": buildTmdbTrending,
  "tmdb-trending-movies": buildTmdbTrendingMovies,
  "tmdb-trending-tv": buildTmdbTrendingTv,
  "tmdb-tv-details": buildTmdbTvDetails,
  "traces-get": buildTracesGet,
  "traces-list-for-agent": buildTracesListForAgent,
  "web-fetch": buildWebFetch,
  "web-search": buildWebSearch,
} satisfies Record<string, (config: unknown, context: ToolContext) => Tool>;

const builders = new Map(Object.entries(BUILDERS));

export const buildTool = (id: string, config: unknown, context: ToolContext) => {
  return builders.get(id)?.(config, context);
};

export type BuiltinToolSet = Record<keyof typeof BUILDERS, Tool>;
