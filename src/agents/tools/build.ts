import type { Tool } from "ai";

import { getCurrentTime } from "./get-current-time";
import { createReadGitHubFiles } from "./github";
import { rawGitHubProvider } from "./github/raw";
import { createWebSearch } from "./search";
import { tavilyProvider } from "./search/tavily";
import { tmdbDiscoverMovie } from "./tmdb/discover-movie";
import { tmdbDiscoverTv } from "./tmdb/discover-tv";
import { tmdbMovieDetails } from "./tmdb/movie-details";
import { tmdbSearchMulti } from "./tmdb/search-multi";
import { tmdbTrendingAll } from "./tmdb/trending-all";
import { tmdbTrendingMovies } from "./tmdb/trending-movies";
import { tmdbTrendingTv } from "./tmdb/trending-tv";
import { tmdbTvDetails } from "./tmdb/tv-details";
import { createWebFetch } from "./web-fetch";

const builders = new Map<string, (config: unknown) => Tool>([
  ["get-current-time", () => getCurrentTime],
  ["github-read", () => createReadGitHubFiles({ provider: rawGitHubProvider })],
  ["tmdb-discover-movie", () => tmdbDiscoverMovie],
  ["tmdb-discover-tv", () => tmdbDiscoverTv],
  ["tmdb-movie-details", () => tmdbMovieDetails],
  ["tmdb-search-multi", () => tmdbSearchMulti],
  ["tmdb-trending-all", () => tmdbTrendingAll],
  ["tmdb-trending-movies", () => tmdbTrendingMovies],
  ["tmdb-trending-tv", () => tmdbTrendingTv],
  ["tmdb-tv-details", () => tmdbTvDetails],
  [
    "web-fetch",
    (config) => {
      const { needsApproval } = config as { needsApproval: boolean };

      return createWebFetch({ needsApproval });
    },
  ],
  [
    "web-search",
    (config) => {
      const { needsApproval } = config as { needsApproval: boolean };

      return createWebSearch({ needsApproval, provider: tavilyProvider });
    },
  ],
]);

export const buildTool = (id: string, config: unknown) => {
  const builder = builders.get(id);

  if (!builder) return undefined;

  return builder(config);
};
