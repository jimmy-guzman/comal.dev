import { z } from "zod";

import { env } from "@/env";

import type { SearchProvider, SearchProviderResult } from "./types";

const tavilyResultSchema = z.object({
  results: z.array(
    z.object({
      content: z.string(),
      title: z.string(),
      url: z.string(),
    }),
  ),
});

export const tavilyProvider = {
  name: "tavily",
  search: async ({ maxResults, query }): Promise<SearchProviderResult> => {
    const response = await fetch("https://api.tavily.com/search", {
      body: JSON.stringify({
        api_key: env.TAVILY_API_KEY,
        max_results: maxResults,
        query,
        search_depth: "basic",
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      throw new Error(`Tavily search failed: ${response.status.toString()} ${response.statusText}`);
    }

    const data = tavilyResultSchema.parse(await response.json());

    return {
      query,
      results: data.results.map((r) => {
        return { snippet: r.content, title: r.title, url: r.url };
      }),
    };
  },
} satisfies SearchProvider;
