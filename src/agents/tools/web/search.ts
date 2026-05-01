import { tool } from "ai";
import { z } from "zod";

import { formatResultsAsMarkdown } from "./search-providers/format";
import { tavilyProvider } from "./search-providers/tavily";
import { webSearchMeta } from "./search.meta";

const webSearch = (needsApproval: boolean) => {
  return tool({
    description:
      "Search the web for current information. Returns a markdown list of titles, URLs, and snippets. Use `web-fetch` to retrieve the full content of a specific result if needed.",
    execute: async ({ maxResults, query }) => {
      const data = await tavilyProvider.search({ maxResults, query });

      return { content: formatResultsAsMarkdown(data), query };
    },
    inputSchema: z.object({
      maxResults: z
        .number()
        .min(1)
        .max(10)
        .default(5)
        .describe("Number of results to return (1-10). Defaults to 5."),
      query: z.string().describe("The search query."),
    }),
    needsApproval,
  });
};

export const buildWebSearch = (config: unknown) => {
  const { needsApproval } = webSearchMeta.configSchema.parse(config);

  return webSearch(needsApproval);
};
