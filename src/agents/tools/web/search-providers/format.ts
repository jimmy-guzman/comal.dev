import type { SearchProviderResult } from "./types";

export const formatResultsAsMarkdown = ({ query, results }: SearchProviderResult): string => {
  if (results.length === 0) return `No results found for: ${query}`;

  return results
    .map((r, i) => {
      return `${(i + 1).toString()}. **${r.title}** — ${r.url}\n   ${r.snippet}`;
    })
    .join("\n\n");
};
