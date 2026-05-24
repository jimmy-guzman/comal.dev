import type { ToolMetadata } from "./meta";

import { agentsCreateMeta } from "./agents/create.meta";
import { agentsDeleteMeta } from "./agents/delete.meta";
import { agentsDiffVersionsMeta } from "./agents/diff-versions.meta";
import { agentsGetMeta } from "./agents/get.meta";
import { agentsListModelsMeta } from "./agents/list-models.meta";
import { agentsListToolsMeta } from "./agents/list-tools.meta";
import { agentsListVersionsMeta } from "./agents/list-versions.meta";
import { agentsListMeta } from "./agents/list.meta";
import { agentsRevertToVersionMeta } from "./agents/revert-to-version.meta";
import { agentsUpdateSuggestionsMeta } from "./agents/update-suggestions.meta";
import { agentsUpdateMeta } from "./agents/update.meta";
import { coreNowMeta } from "./core/now.meta";
import { costSummaryMeta } from "./cost/summary.meta";
import { evalsCreateMeta } from "./evals/create.meta";
import { evalsDeleteMeta } from "./evals/delete.meta";
import { evalsGetHistoryMeta } from "./evals/get-history.meta";
import { evalsListMeta } from "./evals/list.meta";
import { evalsRunBatchMeta } from "./evals/run-batch.meta";
import { evalsRunMeta } from "./evals/run.meta";
import { evalsUpdateMeta } from "./evals/update.meta";
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
import { tracesGetMeta } from "./traces/get.meta";
import { tracesListForAgentMeta } from "./traces/list-for-agent.meta";
import { webFetchMeta } from "./web/fetch.meta";
import { webSearchMeta } from "./web/search.meta";
import { wikidataGetItemMeta } from "./wikidata/get-item.meta";
import { wikidataResolveIdsMeta } from "./wikidata/resolve-ids.meta";
import { wikidataSearchMeta } from "./wikidata/search.meta";

const metadata = Object.freeze([
  Object.freeze(agentsCreateMeta),
  Object.freeze(agentsDeleteMeta),
  Object.freeze(agentsDiffVersionsMeta),
  Object.freeze(agentsGetMeta),
  Object.freeze(agentsListMeta),
  Object.freeze(agentsListModelsMeta),
  Object.freeze(agentsListToolsMeta),
  Object.freeze(agentsListVersionsMeta),
  Object.freeze(agentsRevertToVersionMeta),
  Object.freeze(agentsUpdateMeta),
  Object.freeze(agentsUpdateSuggestionsMeta),
  Object.freeze(coreNowMeta),
  Object.freeze(costSummaryMeta),
  Object.freeze(evalsCreateMeta),
  Object.freeze(evalsDeleteMeta),
  Object.freeze(evalsGetHistoryMeta),
  Object.freeze(evalsListMeta),
  Object.freeze(evalsRunBatchMeta),
  Object.freeze(evalsRunMeta),
  Object.freeze(evalsUpdateMeta),
  Object.freeze(githubReadMeta),
  Object.freeze(tmdbDiscoverMovieMeta),
  Object.freeze(tmdbDiscoverTvMeta),
  Object.freeze(tmdbMovieDetailsMeta),
  Object.freeze(tmdbSearchMeta),
  Object.freeze(tmdbTrendingMeta),
  Object.freeze(tmdbTrendingMoviesMeta),
  Object.freeze(tmdbTrendingTvMeta),
  Object.freeze(tmdbTvDetailsMeta),
  Object.freeze(tracesGetMeta),
  Object.freeze(tracesListForAgentMeta),
  Object.freeze(webFetchMeta),
  Object.freeze(webSearchMeta),
  Object.freeze(wikidataGetItemMeta),
  Object.freeze(wikidataResolveIdsMeta),
  Object.freeze(wikidataSearchMeta),
] satisfies readonly ToolMetadata[]);

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
