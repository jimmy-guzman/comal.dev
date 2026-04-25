export interface SearchResult {
  snippet: string;
  title: string;
  url: string;
}

export interface SearchProviderResult {
  query: string;
  results: SearchResult[];
}

export interface SearchProvider {
  name: string;
  search(input: { maxResults: number; query: string }): Promise<SearchProviderResult>;
}
