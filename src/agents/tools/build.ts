import type { Tool } from "ai";

import { getCurrentTime } from "./get-current-time";
import { createReadGitHubFiles } from "./github";
import { rawGitHubProvider } from "./github/raw";
import { createWebSearch } from "./search";
import { tavilyProvider } from "./search/tavily";
import { createWebFetch } from "./web-fetch";

const builders = new Map<string, (config: unknown) => Tool>([
  ["get-current-time", () => getCurrentTime],
  ["github-read", () => createReadGitHubFiles({ provider: rawGitHubProvider })],
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
